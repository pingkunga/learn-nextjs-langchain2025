import { NextRequest } from "next/server"
import { ChatOpenAI } from "@langchain/openai"
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts"
import { toUIMessageStream } from "@ai-sdk/langchain"
import { createUIMessageStreamResponse, UIMessage } from "ai"
import { RunnableWithMessageHistory } from '@langchain/core/runnables'
import { PostgresChatMessageHistory } from "@langchain/community/stores/message/postgres"
import { getDatabase } from '@/lib/database'

/**
 * ===============================================
 * Chat API Route Handler - API สำหรับการสนทนาพร้อมประวัติ
 * ===============================================
 * 
 * คำอธิบาย:
 * API Route Handler สำหรับจัดการการสนทนาแบบ streaming และเก็บประวัติ
 * รองรับการสร้าง chat sessions และจัดเก็บข้อความใน PostgreSQL
 * 
 * ฟีเจอร์หลัก:
 * - รับส่งข้อความแบบ real-time streaming
 * - เก็บประวัติการสนทนาใน database
 * - จัดการ chat sessions อัตโนมัติ
 * - ดึงประวัติการสนทนาจาก session ID
 * - รองรับ authentication และ authorization
 * 
 * HTTP Methods:
 * - POST: ส่งข้อความและรับคำตอบแบบ streaming
 * - GET: ดึงประวัติข้อความของ session
*/

// ===============================================
// Route Configuration - การตั้งค่า Route
// ===============================================

/**
 * Runtime Configuration
 * กำหนดให้ API นี้ทำงานแบบ Node.js Runtime เพื่อรองรับ PostgreSQL
 * หมายเหตุ: ปิดการใช้ Edge Runtime เพราะ pg library ต้องการ Node.js APIs
 */
// export const runtime = "edge" // ปิดการใช้งาน

/**
 * Dynamic Configuration
 * export const dynamic = 'force-dynamic' เป็น Next.js Route Segment Config ที่ใช้เพื่อ
 * 1. บังคับให้ Route Handler ทำงานแบบ Dynamic - ไม่ให้ Next.js cache response
 * 2. ป้องกัน Static Generation - บังคับให้ render ใหม่ทุกครั้งที่มี request
 * 3. จำเป็นสำหรับ Streaming API - เพื่อให้ response streaming ทำงานได้ถูกต้อง
 */

export const dynamic = 'force-dynamic'

export const maxDuration = 30

const pool = getDatabase()

// ===============================================
// POST Handler - จัดการการส่งข้อความและตอบกลับ
// ===============================================

/**
 * POST Request Handler
 * 
 * ฟังก์ชันสำหรับรับข้อความจากผู้ใช้และส่งคำตอบกลับแบบ streaming
 * พร้อมเก็บประวัติการสนทนาใน database
 * 
 * Flow การทำงาน:
 * 1. ดึงข้อมูลจาก request body
 * 2. จัดการ session (สร้างใหม่หรือใช้ที่มีอยู่)
 * 3. ตั้งค่า AI model และ prompt
 * 4. สร้าง message history
 * 5. ประมวลผลและส่ง streaming response
 * 
 * @param req - NextRequest object
 * @returns Response แบบ streaming หรือ error response
 */

export async function POST(req: NextRequest) {
  try {
    
    const { messages, sessionId, userId }: { 
      messages: UIMessage[];                    // รายการข้อความทั้งหมดในการสนทนา
      sessionId?: string;                       // ID ของ session ปัจจุบัน (optional)
      userId?: string;                          // ID ของผู้ใช้ที่ส่งข้อความ
    } = await req.json()

    let currentSessionId = sessionId

    if (!currentSessionId) {

      //=========================================================
      //สร้าง Session ใหม่ และกำหนด title จากข้อความแรกของ user
      //=========================================================

      const client = await pool.connect()
      try {
        const firstMessage = messages.find(m => m.role === 'user');
        let title = 'New Chat';                // title เริ่มต้น

        if (firstMessage && Array.isArray(firstMessage.parts) && firstMessage.parts.length > 0) {
          const textPart = firstMessage.parts.find(part => part.type === 'text');
          if (textPart && typeof textPart.text === 'string') {
            title = textPart.text.slice(0, 50) + (textPart.text.length > 50 ? '...' : '');
          }
        }

        if (!userId) {
          throw new Error("User ID is required")
        }
        
        const result = await client.query(`
          INSERT INTO chat_sessions (title, user_id)
          VALUES ($1, $2)
          RETURNING id
        `, [title, userId])
        
        currentSessionId = result.rows[0].id

      } finally {
        client.release()
      }
    }

    if (!currentSessionId) {
      throw new Error("Failed to get or create session ID")
    }

    //=========================================================
    // ตั้งค่า Prompt และ Model สำหรับการสนทนา
    //=========================================================

    const prompt = ChatPromptTemplate.fromMessages([
      ["system", "You are a helpful and friendly AI assistant. Answer in Thai language when user asks in Thai."],
      new MessagesPlaceholder("chat_history"),                      // placeholder สำหรับประวัติการสนทนา อ่านจากตัวแปร memory
      ["human", "{input}"],                                         // placeholder สำหรับ input ของผู้ใช้
    ])

    const model = new ChatOpenAI({
      model: "gpt-4o-mini",                                         // ระบุรุ่น AI model ที่ใช้
      temperature: 0.7,                                             // ความสร้างสรรค์
      maxTokens: 1000,                                              // จำนวน token สูงสุดสำหรับคำตอบ
      streaming: true,                                              // เปิดใช้ streaming response
    })

    const chain = prompt.pipe(model)

    //PostgresChatMessageHistory ของ langchain
    const messageHistory = new PostgresChatMessageHistory({
      sessionId: currentSessionId,                                  // ID ของ session ปัจจุบัน
      tableName: "chat_messages",                                   // ชื่อตารางในฐานข้อมูล
      pool: pool,
    })

    const chainWithHistory = new RunnableWithMessageHistory({
      runnable: chain,                                             // chain ที่จะใช้ประมวลผล
      getMessageHistory: () => messageHistory,                     // ฟังก์ชันดึงประวัติข้อความ
      inputMessagesKey: "input",                                   // key สำหรับข้อความ input
      historyMessagesKey: "chat_history",                          // key สำหรับประวัติการสนทนา
    })

    const lastUserMessage = messages.filter(m => m.role === 'user').pop();  // หาข้อความล่าสุดของ user
    let input = ""                                                          // ตัวแปรเก็บข้อความที่จะส่งไป AI

    if (lastUserMessage && Array.isArray(lastUserMessage.parts) && lastUserMessage.parts.length > 0) {
      // หา part แรกที่เป็นประเภท text
      const textPart = lastUserMessage.parts.find(part => part.type === 'text');
      if (textPart) {
        input = textPart.text;                                              // ดึงข้อความออกมา
      }
    }

    if (!input) {
      console.warn("Could not extract user input from the message parts."); // แสดงคำเตือนใน console
      return new Response("No valid user input found.", { status: 400 });   // ส่ง error response กลับ
    }

    const stream = await chainWithHistory.stream(
      {
        input: input,                                                       // ข้อความจากผู้ใช้
      },
      {
        configurable: {
          sessionId: currentSessionId,                                      // ID ของ session สำหรับดึงประวัติ
        },
      }
    )

    const response = createUIMessageStreamResponse({
      stream: toUIMessageStream(stream),                                    // แปลง stream เป็น UI format
      headers: currentSessionId ? {
        'x-session-id': currentSessionId,                                   // ส่ง session ID ผ่าน header
      } : undefined,
    })

    return response                                                         // ส่ง response กลับไปยัง client

  } catch (error) {
    console.error("API Error:", error)
    return new Response(
      JSON.stringify({
        error: "An error occurred while processing your request",          // ข้อความ error หลัก
        details: error instanceof Error ? error.message : 'Unknown error'  // รายละเอียด error
      }),
      {
        status: 500,                                                        // HTTP status 500 = Internal Server Error
        headers: { "Content-Type": "application/json" },                   // กำหนด content type เป็น JSON
      }
    )
  }
}

// ===============================================
// GET Method: ดึงประวัติข้อความของ Session
// ===============================================
/**
 * GET Handler: ดึงประวัติข้อความของ session ที่ระบุ
 * 
 * Purpose:
 * - ดึงข้อความทั้งหมดของ session จาก database
 * - แปลงข้อมูลให้อยู่ในรูปแบบที่ Frontend เข้าใจ
 * - ส่งผลลัพธ์กลับในรูปแบบ JSON
 * 
 * @param req NextRequest object ที่มี query parameters
 * @returns Response object พร้อมข้อมูลข้อความ
 */
export async function GET(req: NextRequest) {
  try {

    const { searchParams } = new URL(req.url)                               // ดึง query parameters จาก URL
    const sessionId = searchParams.get('sessionId')                         // ดึง sessionId parameter

    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: "Session ID is required" }),               // ข้อความ error
        { status: 400, headers: { "Content-Type": "application/json" } }   // HTTP 400 = Bad Request
      )
    }

    const client = await pool.connect()                                     // เชื่อมต่อ database
    
    try {

      const result = await client.query(`
        SELECT message, message->>'type' as message_type, created_at
        FROM chat_messages 
        WHERE session_id = $1 
        ORDER BY created_at ASC
      `, [sessionId])

      const messages = result.rows.map((row, index) => {
        const messageData = row.message                                     // ข้อมูล message ในรูปแบบ JSON
        

        let role = 'user'                                                   // ค่าเริ่มต้น
        if (row.message_type === 'ai') {
          role = 'assistant'                                                // ข้อความจาก AI
        } else if (row.message_type === 'human') {
          role = 'user'                                                     // ข้อความจากผู้ใช้
        }
        
        return {
          id: `history-${index}`,                                           // unique ID สำหรับ message
          role: role,                                                       // บทบาทของผู้ส่ง
          content: messageData.content || messageData.text || messageData.message || '', // เนื้อหาข้อความ
          createdAt: row.created_at                                         // เวลาที่สร้าง
        }
      })


      return new Response(
        JSON.stringify({ messages }),                                       // ข้อมูลข้อความในรูปแบบ JSON
        { 
          status: 200,                                                      // HTTP 200 = OK
          headers: { "Content-Type": "application/json" }                   // กำหนด content type
        }
      )
    } finally {
      client.release()                                                      // คืน connection กลับไปยัง pool
    }
  } catch (error) {
    console.error("Error fetching messages:", error)                        // แสดง error ใน console
    
    return new Response(
      JSON.stringify({
        error: "Failed to fetch messages",                                  // ข้อความ error หลัก
        details: error instanceof Error ? error.message : 'Unknown error'   // รายละเอียด error
      }),
      {
        status: 500,                                                        // HTTP 500 = Internal Server Error
        headers: { "Content-Type": "application/json" }                     // กำหนด content type
      }
    )
  }
}