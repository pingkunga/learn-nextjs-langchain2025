'use client'

import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"


function ChatPage() {
    const router = useRouter()
    const [, setChecking] = useState(true)

    useEffect(() => {
        async function checkAuth() {
            const res = await fetch('/api/check-auth')
            const result = await res.json()
            if (!result.authenticated) {
                router.push('/auth/login')
            } else {
                setChecking(false)
            }
        }
        checkAuth()
    }, [router])


    // useChat from 'ai/react'  // ตัวช่วยสร้าง chat interface (UI) แบบสำเร็จรูป
    const { messages, sendMessage, status } = useChat({
        transport: new DefaultChatTransport({
            api: "/api/chat_04_stream",
        }),
    })

    //Store the chat input in a state variable
    const [input, setInput] = useState("")

    console.log("Render Chat Page:", input)
    return (
        <div className="max-w-3xl mx-auto w-full mt-20">
            <h1>Chat Page</h1>
            <form onSubmit={(e) => {
                e.preventDefault()
                sendMessage({ text: input })
                setInput("")
            }}>
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    className="border border-red-300 rounded-md p-2 w-96"
                />
                <button type="submit" className="ml-2 p-2 bg-blue-500 text-white rounded-md">
                    Send
                </button>
            </form>

            {/* Show status */}
            {
            <div className="mt-4">
                {status === "submitted" || status === "streaming"  && <div className="text-gray-500">Loading...</div>}
                {status === "error" && <div className="text-red-500">Error sending message</div>}
            </div>
            }

            {/* Display chat messages */}
            {
            <div className="mt-4">
                {messages.map((msg, msgIndex) => (
                    <div key={msgIndex} className={`flex ${msg.role === 'user' ? 'justify-end': 'justify-start'}`}>
                        {msg.parts.map((part, index) => 
                            part.type === 'text' ? (
                                <div key={index} className="whitespace-pre-wrap"> {part.text}</div>
                            ) : null
                        )}
                    </div>
                ))}
            </div>
            }
        </div>
    )
}

export default ChatPage