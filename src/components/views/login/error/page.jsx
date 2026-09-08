// src/app/components/views/login/error/page.jsx
"use client";;
import Link from 'next/link';
import { use } from "react";

export default function AuthError(props) {
  const searchParams = use(props.searchParams);
  return (
    <div style={{ padding: 24, color: 'white', background: '#0f172a', minHeight: '100vh' }}>
      <h1>Signin Error</h1>
      <p>{decodeURIComponent(searchParams?.error || '')}</p>
      <Link href="/" style={{ color: '#60a5fa' }}>Back to login</Link>
    </div>
  );
}