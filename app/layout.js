import Sidebar from "./components/Sidebar";
import "./globals.css";
// import Sidebar from "../components/Sidebar";

export const metadata = {
  title: "Polymer Containers Attendance",
  description: "Attendance management system",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="h-auto bg-gray-50 text-black">
        <Sidebar />
        <main className="ml-64 h-auto bg-white p-6">{children}</main>
      </body>
    </html>
  );
}



// import { Geist, Geist_Mono } from "next/font/google";
// import "./globals.css";

// const geistSans = Geist({
//   variable: "--font-geist-sans",
//   subsets: ["latin"],
// });

// const geistMono = Geist_Mono({
//   variable: "--font-geist-mono",
//   subsets: ["latin"],
// });

// export const metadata = {
//   title: "Polymer Containers Attendance",
//   description: "Attendance management system",
// };

// export default function RootLayout({ children }) {
//   return (
//     <html lang="en">
//       {/* <body className="min-h-screen bg-gray-50 text-black"> */}
//        <body
//         className={`${geistSans.variable} ${geistMono.variable} antialiased`}
//       >
//         {children}
//       </body>
//     </html>
//   );
// }
