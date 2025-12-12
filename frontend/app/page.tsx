import { redirect } from 'next/navigation';

export default function Home() {
  // 直接重定向到仪表板页面
  redirect('/dashboard');
}
