import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {title:"Fate After Hours",description:"A Fate Accelerated campaign toolkit for players and GMs: build characters, roll dice, prepare scenes, resolve actions, and save your table."};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="en"><body>{children}</body></html>;}
