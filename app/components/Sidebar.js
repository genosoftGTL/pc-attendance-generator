"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const menu = [
  { href: "/", label: "Dashboard" },
  { href: "/employees", label: "Employees" },
  { href: "/logs", label: "Logs" },
  { href: "/reports", label: "Reports" },
  { href: "/settings", label: "Settings" },
];

export default function Sidebar() {
  const pathname = usePathname();
  return (
    <div className="w-64 h-screen bg-white text-black shadow-md fixed">
      <div className="p-4 font-bold text-xl border-b">PC Attendance</div>
      <nav className="p-4 space-y-2">
        {menu.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`block px-3 py-2 rounded 
              ${pathname === item.href ? "bg-blue-100 font-semibold" : "hover:bg-gray-100"}`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
