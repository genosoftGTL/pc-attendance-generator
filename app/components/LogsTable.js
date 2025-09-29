"use client";

export default function LogsTable({ logs }) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-100 text-left">
            <th className="p-2 border">User</th>
            <th className="p-2 border">Timestamp</th>
            <th className="p-2 border">Status</th>
          </tr>
        </thead>
        <tbody>
          {logs.length === 0 && (
            <tr>
              <td className="p-2 text-center border" colSpan="3">
                No logs found
              </td>
            </tr>
          )}
          {logs.map(log => (
            <tr key={log.id} className="border-b">
              <td className="p-2 border">{log.userId}</td>
              <td className="p-2 border">
                {log.timestamp?.toDate?.().toLocaleString?.() ?? ""}
              </td>
              <td className="p-2 border">
                {log.status === 0 ? "Check-In" : "Check-Out"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
