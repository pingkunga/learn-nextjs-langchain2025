'use client'

import { useState } from "react"

function ChatPage() {

    //Store the chat input in a state variable
    const [input, setInput] = useState("")

    console.log("Render Chat Page:", input)
    return (
        <div>
            <h1>Chat Page</h1>
            <form action="">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                />
            </form>
        </div>
    )
}

export default ChatPage