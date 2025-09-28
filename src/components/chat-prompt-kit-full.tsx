"use client"

import {
  ChatContainerContent,
  ChatContainerRoot,
} from "@/components/ui/chat-container"
import {
  Message,
  MessageAction,
  MessageActions,
  MessageContent,
} from "@/components/ui/message"
import {
  PromptInput,
  PromptInputAction,
  PromptInputActions,
  PromptInputTextarea,
} from "@/components/ui/prompt-input"
import { ScrollButton } from "@/components/ui/scroll-button"
import { Button } from "@/components/ui/button"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"
import {
  ArrowUp,
  Copy,
  Globe,
  Mic,
  MoreHorizontal,
  Pencil,
  Plus,
  ThumbsDown,
  ThumbsUp,
  Trash,
} from "lucide-react"
import { useRef, useState, useEffect } from "react"
import { useChatContext } from "@/contexts/chat-context"
import { DEFAULT_MODEL } from "@/constants/models"
import { ModelSelector } from "./model-selector"

import { useChat } from '@ai-sdk/react'                                      // Hook สำหรับจัดการ AI chat
import { createCustomChatTransport } from '@/lib/custom-chat-transport';     // Custom transport สำหรับส่งข้อมูล
import { createClient } from '@/lib/client'                                  // Supabase client
import { API_BASE, buildApiUrl } from "@/constants/api" 

/**
 * Interface สำหรับ Message Object
 * 
 * Structure:
 * - id: string - ID ของข้อความ
 * - role: string - บทบาท ('user' หรือ 'assistant')
 * - parts: Array - ส่วนประกอบของข้อความ
 */
interface MessageType {
  id: string;                                                                // ID ของข้อความ
  role: string;                                                              // บทบาทของผู้ส่ง (user/assistant)
  parts: Array<{ type: string; text: string }>;                              // เนื้อหาข้อความแบบ parts สำหรับ Streaming
}

// Sample Prompt Interface
interface SamplePrompt {
  title: string;
  prompt: string;
  icon: string;
}

// Sample Prompt Data
const samplePrompts: SamplePrompt[] = [
    {
      title: 'สรุปข้อมูลจากบทความ',
      prompt: 'สามารถช่วยสรุปสาระสำคัญจากบทความที่ฉันให้มาได้ไหม?',
      icon: '📋'
    },
    {
      title: 'เขียนโค้ดให้ทำงาน',
      prompt: 'ช่วยเขียนโค้ด Python สำหรับการอ่านไฟล์ CSV และแสดงข้อมูลเป็นกราฟ',
      icon: '💻'
    },
    {
      title: 'แปลภาษา',
      prompt: 'ช่วยแปลข้อความนี้จากภาษาไทยเป็นภาษาอังกฤษ',
      icon: '🌐'
    },
    {
      title: 'วิเคราะห์ข้อมูล',
      prompt: 'ช่วยวิเคราะห์ข้อมูลการขายของบริษัทในไตรมาสที่ผ่านมา',
      icon: '📊'
    },
    {
      title: 'เขียนอีเมล์',
      prompt: 'ช่วยเขียนอีเมล์สำหรับขอนัดหมายประชุมกับลูกค้า',
      icon: '✉️'
    },
    {
      title: 'แก้ไขข้อผิดพลาด',
      prompt: 'โค้ดของฉันมีข้อผิดพลาด สามารถช่วยหาและแก้ไขได้ไหม?',
      icon: '🐛'
    }
]

export function ChatPromptKitFull() {

  const [prompt, setPrompt] = useState("")
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL)
  const {showWelcome, setShowWelcome } = useChatContext()
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const [userId, setUserId] = useState<string>('')
  const [sessionId, setSessionId] = useState<string | undefined>(undefined)   // chat session id
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)             // loading chat history on sidebar
  const [loadedMessages, setLoadedMessages] = useState<MessageType[]>([])     // messages loaded from history by sessionId
  

  // ============================================================================
  // Load Chat History - โหลดประวัติการสนทนา
  // ============================================================================

  /**
   * ฟังก์ชันสำหรับโหลดประวัติข้อความจาก sessionId
   * - ดึงข้อมูลประวัติการสนทนาจาก API
   * - แปลงข้อมูลจาก database format เป็น UI format
   * - จัดการ error และ loading state
   * @param sessionIdToLoad - ID ของ session ที่ต้องการโหลด
   */
  const loadChatHistory = async (sessionIdToLoad: string) => {
    // ตรวจสอบว่ามี sessionId หรือไม่
    if (!sessionIdToLoad) return

    // เริ่มแสดงสถานะ loading
    setIsLoadingHistory(true)
    
    try {
      // เรียก API เพื่อดึงประวัติการสนทนา
      const apiUrl = buildApiUrl(API_BASE, { sessionId: sessionIdToLoad })
      const response = await fetch(apiUrl)

      // ตรวจสอบว่า API response สำเร็จหรือไม่
      if (!response.ok) {
        throw new Error('Failed to load chat history')
      }
      
      // แยกข้อมูล JSON จาก response
      const data = await response.json()
      const loadedMessagesData = data.messages || []
      
      /**
       * แปลงข้อความจาก database format เป็น UI format
       * 
       * Database Format: { id, role, content/text }
       * UI Format: { id, role, parts: [{ type: 'text', text }] }
       */
      const formattedMessages = loadedMessagesData.map((msg: { 
        id?: string; 
        role?: string; 
        content?: string; 
        text?: string 
      }, index: number) => ({
        id: msg.id || `loaded-${index}`,                                     // ใช้ ID จาก DB หรือสร้างใหม่
        role: msg.role || 'user',                                            // ใช้ role ที่ได้จาก API โดยตรง
        parts: [{ type: 'text', text: msg.content || msg.text || '' }]       // แปลงเป็น parts format
      }))
      
      // เก็บข้อความที่โหลดไว้ใน state
      setLoadedMessages(formattedMessages)
      console.log('Loaded messages:', formattedMessages)
      
    } catch (error) {
      // จัดการข้อผิดพลาดที่เกิดขึ้น
      console.error('Error loading chat history:', error)
    } finally {
      // หยุดแสดงสถานะ loading (ทำงานไม่ว่าจะสำเร็จหรือไม่)
      setIsLoadingHistory(false)
    }
  }

  /**
   * Effect สำหรับโหลดประวัติเมื่อมี sessionId และไม่ใช่ welcome state
   * - โหลดประวัติการสนทนาเมื่อมี session ID
   * - แสดงข้อความต่อจากที่เหลือไว้
   * - รองรับการกลับมาดูประวัติการสนทนา
   * 
   * Conditions:
   * - มี sessionId
   * - มี userId (ผู้ใช้ login แล้ว)
   * - ไม่ใช่ welcome state (showWelcome = false)
   * 
   * Dependencies: [sessionId, userId, showWelcome]
   */
  useEffect(() => {
    // โหลดประวัติเฉพาะเมื่อไม่ใช่ welcome state และมี sessionId
    if (sessionId && userId && !showWelcome) {
      loadChatHistory(sessionId)                                             // เรียกฟังก์ชันโหลดประวัติ
    }
  }, [sessionId, userId, showWelcome])
  
  // ============================================================================
  // CHAT HOOK INITIALIZATION - การตั้งค่า useChat Hook
  // ============================================================================

  /**
   * ใช้ useChat hook เพื่อจัดการสถานะการสนทนา
   * 
   * Purpose:
   * - จัดการข้อความที่ส่งและรับ
   * - จัดการสถานะการส่งข้อความ (loading, streaming)
   * - ตั้งค่า custom transport สำหรับส่งข้อมูล
   * - รับ session ID ใหม่จาก response header
   * 
   * Features:
   * - messages: array ของข้อความในการสนทนาปัจจุบัน
   * - sendMessage: ฟังก์ชันสำหรับส่งข้อความ
   * - status: สถานะปัจจุบัน ('ready', 'submitted', 'streaming')
   * - setMessages: ฟังก์ชันสำหรับตั้งค่าข้อความ
   */
  const { messages, sendMessage, status, setMessages } = useChat({
    /**
     * Custom transport configuration
     * 
     * Purpose:
     * - กำหนด API endpoint ที่จะส่งข้อมูลไป
     * - จัดการ response และดึง session ID
     * - บันทึก session ID ไว้ใน localStorage
     */
    transport: createCustomChatTransport({
      api: API_BASE,                                           // API endpoint สำหรับส่งข้อความ
      
      /**
       * Callback function ที่ทำงานเมื่อได้รับ response
       * 
       * Purpose:
       * - ดึง session ID จาก response header
       * - บันทึก session ID ใน state และ localStorage
       * - ใช้สำหรับความต่อเนื่องของการสนทนา
       * 
       * @param response - Response object จาก API
       */
      onResponse: (response: Response) => {
        const newSessionId = response.headers.get('x-session-id');           // ดึง session ID จาก header
        if (newSessionId) {
          console.log('Received new session ID:', newSessionId);
          setSessionId(newSessionId);                                        // อัปเดต session ID ใน state
          localStorage.setItem('currentSessionId', newSessionId);            // บันทึก sessionId ล่าสุดไว้ใน localStorage
        }
      },
    }),
  })
  
  // Focus textarea on component mount when on welcome screen
  useEffect(() => {
    const supabaseClient = createClient()

    const getUserData = async () => {
      const { data: { user }, error } = await supabaseClient.auth.getUser()
      if (error) {
        console.error('Error fetching user data:', error)
      } else {
        if (user) {
          setUserId(user.id)
          console.log('User ID:', user.id)
          const savedSessionId = localStorage.getItem('currentSessionId')
          if (savedSessionId && showWelcome) {
            setSessionId(savedSessionId)
            setShowWelcome(false)  // hide welcome screen if has sessionId
            console.log('Restored session ID from localStorage:', savedSessionId)
          }
        }
      }
    }
    getUserData()
    if (showWelcome) {
      setTimeout(() => {
        textareaRef.current?.focus()
      }, 100)
    }
  }, [showWelcome])

  const handleSubmit = () => {

    if (!prompt.trim()) return

     /**
     * Structure:
     * - role: 'user' - ระบุว่าเป็นข้อความจากผู้ใช้
     * - parts: array ของส่วนประกอบข้อความ
     *   - type: 'text' - ประเภทของเนื้อหา
     *   - text: เนื้อหา prompt
     */
    const messageToSend = {
      role: 'user' as const,
      parts: [{ type: 'text' as const, text: prompt.trim() }],
    };

    // ส่งข้อความไปยัง AI ผ่าน useChat hook
    sendMessage(messageToSend, {
      body: {
        userId: userId,                                                     // ส่ง user ID สำหรับการระบุตัวตน
        sessionId: sessionId,                                               // ส่ง session ID สำหรับความต่อเนื่อง
      },
    })

    // รีเซ็ต UI state
    setPrompt("")                                                            // ล้างข้อความใน input
    setShowWelcome(false)                                                    // ซ่อนหน้า welcome
  }

  const handleSamplePrompt = (samplePrompt: string) => {
    setPrompt(samplePrompt)
  }

  // ============================================================================
  // Authen Check - ตรวจสอบการเข้าสู่ระบบ
  // ถ้าไม่มี userId แสดงหน้าขอให้ login ก่อนใช้งาน
  // ============================================================================
  if (!userId) {
    return (
      <main className="flex h-screen flex-col overflow-hidden">
        {/* Header Section - ส่วนหัวของหน้า */}
        <header className="bg-background z-10 flex h-16 w-full shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />                              {/* ปุ่มเปิด/ปิด sidebar */}
          <div className="text-foreground flex-1">New Chat</div>            {/* ชื่อหน้า */}
        </header>
        
        {/* Content Section - ส่วนเนื้อหาหลัก */}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-gray-700 mb-2">กรุณาเข้าสู่ระบบ</h2>
            <p className="text-gray-500">คุณต้องเข้าสู่ระบบก่อนเพื่อใช้งาน Chat</p>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="flex h-screen flex-col overflow-hidden">
      <header className="bg-background z-10 flex h-16 w-full shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <div className="text-foreground flex-1">New Chat</div>
        {/* Model Selector */}
        <ModelSelector
          selectedModel={selectedModel}
          onModelChange={setSelectedModel}
        />
      </header>

      {/* ============================================================================ */}
      {/* CHAT CONTAINER - ส่วนแสดงข้อความการสนทนา */}
      {/* ============================================================================ */}
      <div ref={chatContainerRef} className="relative flex-1 overflow-hidden">
        <ChatContainerRoot className="h-full">
          <ChatContainerContent
            className={cn(
              "p-4",
              // แสดง welcome screen ตรงกลางเมื่อไม่มีข้อความ
              (showWelcome && messages.length === 0 && loadedMessages.length === 0) 
                ? "flex items-center justify-center h-full" 
                : ""
            )}
          >

            {/* Welcome Screen - หน้าต้อนรับสำหรับการสนทนาใหม่ 
                - ถ้าไม่มี messages แสดง Welcome Screen Layout
                - ถ้ามี messages แสดง Chat
            */}
            {(showWelcome && messages.length === 0 && loadedMessages.length === 0) ? (
              /**
               * Welcome Screen Layout
               * 
               * Components:
               * 1. AI Avatar และ Welcome Message
               * 2. Sample Prompts Grid
               * 3. Interactive Buttons สำหรับ quick start
               */
              <div className="text-center max-w-3xl mx-auto">
                
                {/* AI Avatar และ Welcome Message */}
                <div className="mb-8">
                  <div className="h-20 w-20 mx-auto mb-6 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                    <span className="text-white font-bold text-2xl">AI</span>
                  </div>
                  <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-4">
                    Welcome to PingkungA AI
                  </h1>
                  <p className="text-lg text-slate-600 dark:text-slate-400 mb-8">
                    ยินดีต้อนรับสู่ AI Chatbot ใช้ LangChain / Supabase / AI BackEnd (Azure AI Foundary, OpenAI, Ollama etc.)
                    เริ่มต้นด้วยตัวอย่างด้านล่างหรือพิมพ์คำถามของคุณเลย
                  </p>                    

                </div>

                {/* Sample Prompts Grid - ตัวอย่างคำถามสำหรับ quick start */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {samplePrompts.map((sample, index) => (
                    <button 
                      key={index}
                      onClick={() => handleSamplePrompt(sample.prompt)}          // ใส่ prompt เมื่อคลิก
                      className="bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 rounded-lg p-4 text-left transition"
                    >
                      <div className="text-3xl mb-2">{sample.icon}</div>          {/* ไอคอน */}
                      <h3 className="font-semibold text-lg mb-1">{sample.title}</h3> {/* ชื่อ prompt */}
                      <p className="text-sm text-gray-600 dark:text-gray-400">{sample.prompt}</p> {/* คำอธิบาย */}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              // ============================================================================
              // CHAT MESSAGES DISPLAY - การแสดงข้อความการสนทนา
              // ============================================================================
              
              /**
               * Chat Messages Section
               * 
               * Purpose:
               * - แสดงข้อความจากประวัติ (loadedMessages)
               * - แสดงข้อความใหม่ (messages จาก useChat)
               * - รองรับทั้ง user และ assistant messages
               * - แสดง message actions (copy, like, edit, etc.)
               */
              <div className="space-y-3 max-w-3xl mx-auto w-full">
                
                {/* รวม loadedMessages และ messages จาก useChat */}
                {[...loadedMessages, ...messages].map((message, index) => {
                  const isAssistant = message.role === "assistant"            // ตรวจสอบว่าเป็นข้อความจาก AI หรือไม่
                  
                  return (
                    /**
                     * Message Component
                     * 
                     * Props:
                     * - key: unique identifier สำหรับ React rendering
                     * - isAssistant: boolean สำหรับแยกประเภทข้อความ
                     * - bubbleStyle: ใช้ bubble style สำหรับแสดงผล
                     */
                    <Message
                      key={`${message.id}-${index}`}                         // unique key สำหรับ React
                      isAssistant={isAssistant}                              // ระบุประเภทข้อความ
                      bubbleStyle={true}                                     // ใช้ bubble style
                    >
                      
                      {/* Message Content - เนื้อหาข้อความ */}
                      <MessageContent
                        isAssistant={isAssistant}
                        bubbleStyle={true}
                        markdown                                             // แสดงเป็น markdown format
                      >
                        {/* แปลงข้อความจาก parts structure เป็น string */}
                        {typeof message === 'object' && 'parts' in message && message.parts
                          ? message.parts.map((part) => 
                              'text' in part ? part.text : ''
                            ).join('')
                          : String(message)}
                      </MessageContent>
                      
                      {/* Message Actions - ปุ่มสำหรับจัดการข้อความ */}
                      <MessageActions
                        isAssistant={isAssistant}
                        bubbleStyle={true}
                      >
                        
                        {/* Copy Button - ปุ่มสำหรับ copy ข้อความ */}
                        <MessageAction tooltip="Copy" bubbleStyle={true}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-gray-500 hover:text-gray-700 rounded-full"
                          >
                            <Copy size={14} />
                          </Button>
                        </MessageAction>
                        
                        {/* Assistant Message Actions - ปุ่มสำหรับข้อความจาก AI */}
                        {isAssistant && (
                          <>
                            {/* Upvote Button */}
                            <MessageAction tooltip="Upvote" bubbleStyle={true}>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-gray-500 hover:text-gray-700 rounded-full"
                              >
                                <ThumbsUp size={14} />
                              </Button>
                            </MessageAction>
                            
                            {/* Downvote Button */}
                            <MessageAction tooltip="Downvote" bubbleStyle={true}>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-gray-500 hover:text-gray-700 rounded-full"
                              >
                                <ThumbsDown size={14} />
                              </Button>
                            </MessageAction>
                          </>
                        )}
                        
                        {/* User Message Actions - ปุ่มสำหรับข้อความจากผู้ใช้ */}
                        {!isAssistant && (
                          <>
                            {/* Edit Button */}
                            <MessageAction tooltip="Edit" bubbleStyle={true}>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-gray-500 hover:text-gray-700 rounded-full"
                              >
                                <Pencil size={14} />
                              </Button>
                            </MessageAction>
                            
                            {/* Delete Button */}
                            <MessageAction tooltip="Delete" bubbleStyle={true}>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-gray-500 hover:text-gray-700 rounded-full"
                              >
                                <Trash size={14} />
                              </Button>
                            </MessageAction>
                          </>
                        )}
                      </MessageActions>
                    </Message>
                  )
                })}
              </div>
            )}
          </ChatContainerContent>
          
          {/* ============================================================================ */}
          {/* SCROLL BUTTON - ปุ่มสำหรับ scroll ไปข้างล่าง */}
          {/* ============================================================================ */}
          
          {/* แสดง scroll button เฉพาะเมื่อไม่ใช่ welcome screen */}
          {!(showWelcome && messages.length === 0 && loadedMessages.length === 0) && (
            <div className="absolute bottom-4 left-1/2 flex w-full max-w-3xl -translate-x-1/2 justify-end px-5">
              <ScrollButton className="shadow-sm" />                        {/* ปุ่ม scroll to bottom */}
            </div>
          )}
        </ChatContainerRoot>
      </div>

      <div className="bg-background z-10 shrink-0 px-3 pb-3 md:px-5 md:pb-5">
        <div className="mx-auto max-w-3xl">
          {/* แสดงสถานะการพิมพ์ของ AI */}
          {(status === 'submitted' || status === 'streaming') && 
            <div className="text-gray-500 italic mb-2 text-sm">🤔 PingBot กำลังคิด...</div>
          }
          
          {/* แสดงสถานะการโหลดประวัติ */}
          {isLoadingHistory && 
            <div className="text-blue-500 italic mb-2 text-sm">📚 กำลังโหลดประวัติการสนทนา...</div>
          }

          {/* ============================================================================ */}
          {/* PROMPT INPUT COMPONENT - ส่วน input หลัก */}
          {/* ============================================================================ */}
          
          {/*
           * PromptInput Component
           * 
           * Purpose:
           * - รับข้อความจากผู้ใช้
           * - จัดการ loading state
           * - ส่งข้อความเมื่อกด Enter หรือคลิกปุ่ม
           * 
           * Props:
           * - isLoading: สถานะการโหลด
           * - value: ข้อความในปัจจุบัน
           * - onValueChange: callback เมื่อข้อความเปลี่ยน
           * - onSubmit: callback เมื่อส่งข้อความ
           */}
          <PromptInput
            isLoading={status !== 'ready'}
            value={prompt}
            onValueChange={setPrompt}
            onSubmit={handleSubmit}
            className="border-input bg-popover relative z-10 w-full rounded-3xl border p-0 pt-1 shadow-xs"
          >
            <div className="flex flex-col">
              <PromptInputTextarea
                ref={textareaRef}
                placeholder="Ask anything to start a new chat..."
                className="min-h-[44px] pt-3 pl-4 text-base leading-[1.3] sm:text-base md:text-base"
              />

              <PromptInputActions className="mt-5 flex w-full items-center justify-between gap-2 px-3 pb-3">
                {/* Left Actions Group - กลุ่มปุ่มด้านซ้าย */}
                <div className="flex items-center gap-2">
                  <PromptInputAction tooltip="Add a new action">
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-9 rounded-full"
                    >
                      <Plus size={18} />
                    </Button>
                  </PromptInputAction>

                  <PromptInputAction tooltip="Search">
                    <Button variant="outline" className="rounded-full">
                      <Globe size={18} />
                      Search
                    </Button>
                  </PromptInputAction>

                  <PromptInputAction tooltip="More actions">
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-9 rounded-full"
                    >
                      <MoreHorizontal size={18} />
                    </Button>
                  </PromptInputAction>
                </div>
                {/* Right Actions Group - กลุ่มปุ่มด้านขวา */}
                <div className="flex items-center gap-2">
                  <PromptInputAction tooltip="Voice input">
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-9 rounded-full"
                    >
                      <Mic size={18} />
                    </Button>
                  </PromptInputAction>

                  <Button
                    size="icon"
                    disabled={!prompt.trim() || status !== 'ready' || !userId}
                    onClick={handleSubmit}
                    className="size-9 rounded-full"
                  >

                    {/* แสดง icon ตาม status */}
                    {status === 'ready' ? (
                      /* แสดงลูกศรเมื่อพร้อม */
                      <ArrowUp size={18} />
                    ) : (
                      /* แสดง loading indicator */
                      <span className="size-3 rounded-xs bg-white" />
                    )}
                  </Button>
                </div>
              </PromptInputActions>
            </div>
          </PromptInput>
        </div>
      </div>
    </main>
  )
}