
# AI Chatbot Next.js + LangChain + AI SDK

This project is a modern AI chatbot platform built with [Next.js](https://nextjs.org), integrating [LangChain](https://js.langchain.com/) and [AI SDK](https://github.com/vercel/ai) for advanced conversational AI features, streaming, and UI components.

## Features

- Built with Next.js App Router
- AI SDK integration for chat, streaming, and UI
- LangChain for advanced LLM orchestration
- Supabase authentication (example)
- Middleware for session and route protection
- Custom API endpoints for authentication and chat


## Environment Variables

This project uses environment variables for API keys and service configuration. See the `.env.example` file for all required variables. All sensitive values in `.env.example` are blurred or replaced with placeholders for safety.

**To use:**

1. Copy `.env.example` to `.env` in your project root:
	```bash
	cp .env.example .env
	```
2. Fill in your real API keys and credentials in the new `.env` file.

---
## Getting Started

Install dependencies:

```bash
npm install
# or
yarn install
```

Run the development server (default port 3000):

```bash
npm run dev
```

Or run on a custom port (e.g. 4000):

```powershell
$env:PORT=4000; npm run dev
```

Open [http://localhost:3000](http://localhost:3000) or your chosen port in your browser.

## Project Structure

```
├── public/                     # Static assets (images, icons, etc.)
├── src/
│   ├── app/                    # Next.js app directory (routing, pages, API, components)
│   │   ├── page.tsx            # Home page
│   │   ├── chat/
│   │   │   └── page.tsx        # Chat page (AI SDK + LangChain)
│   │   ├── simplechat/
│   │   │   └── page.tsx        # Simple chat page
│   │   └── api/
│   │       └── check-auth/
│   │           └── route.ts    # API route for authentication check
│   ├── components/             # React components (e.g. ChatPromptKitFull, ChatSimple)
│   ├── lib/                    # Shared libraries (e.g. Supabase client)
│   └── middleware.ts           # Route protection and session middleware
├── package.json                # Project dependencies and scripts
├── tsconfig.json               # TypeScript configuration
├── next.config.ts              # Next.js configuration
├── postcss.config.mjs          # PostCSS configuration
├── eslint.config.mjs           # ESLint configuration
└── README.md                   # Project documentation
```

## Usage
- Home page (`/`) is public
- All other pages require login (see `src/middleware.ts`)
- Chat page uses AI SDK and LangChain for streaming chat (`/chat`)

#### Sample Prompts for Tool Calling

You can use the following sample prompts to interact with the chatbot and trigger tool calls:

##### Tool 1: getProductInfoTool - ดูข้อมูลสินค้า
- Gaming Mouse ราคาเท่าไหร่?
- Smartwatch มีในสต็อกไหม?
- Earbuds มีรายละเอียดสินค้าอย่างไร?

##### Tool 2: getSalesDataTool - ดูประวัติการขาย
- ขาย Gaming Mouse ได้กี่ชิ้นในเดือนที่ผ่านมา?
- Smartwatch ขายไปแล้วกี่ชิ้น?
- สรุปยอดขายของสินค้า Mechanical Keyboard

##### เรียกทำงานพร้อมกันทั้ง 2 Tools
- สินค้า Running Shoes ราคาเท่าไหร่ และขายไปแล้วกี่ชิ้น?
- Gaming Mouse ขายไปได้กี่ชิ้นแล้ว และตอนนี้เหลือในสต็อกเท่าไหร่?
- Smartwatch มีรายละเอียดสินค้าอย่างไร และขายไปแล้วกี่ชิ้น?

##### แสดงเป็นตาราง Markdown
- สินค้าที่มีคำว่า "shoes" ในชื่อ มีอะไรบ้าง แสดงเป็นตาราง
- เปรียบเทียบยอดขายของ Gaming Mouse และ E-book Reader แสดงในตาราง

คุณสามารถถามคำถามทั่วไปได้ด้วยเช่นกัน

## Notes

- AI SDK can be used as a LangChain alternative for some use cases, but is still evolving
- Supports streaming responses and UI out-of-the-box
- For authentication, Supabase is used as an example (can be replaced)

## Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [LangChain.js Documentation](https://js.langchain.com/docs/)
- [AI SDK by Vercel](https://github.com/vercel/ai)

---

Feel free to customize and extend this project for your own AI chatbot needs!