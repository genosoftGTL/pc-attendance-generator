"use client";

export default function UsersTable({ users }) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-100 text-left">
            <th className="p-2 border">Name</th>
            <th className="p-2 border">Device User ID</th>
            <th className="p-2 border">Created At</th>
          </tr>
        </thead>
        <tbody>
          {users.length === 0 && (
            <tr>
              <td colSpan="3" className="p-2 text-center border">
                No users found
              </td>
            </tr>
          )}
          {users.map(user => (
            <tr key={user.id} className="border-b">
              <td className="p-2 border">{user.name}</td>
              <td className="p-2 border">{user.deviceUserId}</td>
              <td className="p-2 border">
                {user.createdAt?.toDate?.().toLocaleDateString?.() ?? ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}



// "use client";

// export default function UsersTable({ users }) {
//   return (
//     <div className="mt-4 overflow-x-auto">
//       <table className="w-full border-collapse">
//         <thead>
//           <tr className="bg-gray-100 text-left">
//             <th className="p-2 border">Name</th>
//             <th className="p-2 border">Device User ID</th>
//             <th className="p-2 border">Created At</th>
//           </tr>
//         </thead>
//         <tbody>
//           {users.length === 0 && (
//             <tr>
//               <td colSpan="3" className="p-2 text-center border">
//                 No users found
//               </td>
//             </tr>
//           )}
//           {users.map(user => (
//             <tr key={user.id} className="border-b">
//               <td className="p-2 border">{user.name}</td>
//               <td className="p-2 border">{user.deviceUserId}</td>
//               <td className="p-2 border">
//                 {user.createdAt?.toDate?.().toLocaleDateString?.() ?? ""}
//               </td>
//             </tr>
//           ))}
//         </tbody>
//       </table>
//     </div>
//   );
// }
