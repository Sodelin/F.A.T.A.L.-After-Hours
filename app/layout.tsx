import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {title:"Fate After Hours",description:"A persistent Fate Accelerated table. Create a character, join friends, play a scene, and return to your story."};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="en"><body>{children}</body></html>;}
