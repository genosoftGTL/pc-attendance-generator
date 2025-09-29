export default function Dashboard() {
  return (
    <div className="bg-white text-black rounded-lg shadow p-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p className="text-gray-600 mt-2">
        Welcome to PC Attendance Report Generator.
      </p>

      <div className="grid grid-cols-3 gap-4 mt-6">
        <div className="p-4 bg-blue-50 rounded shadow">
          <h2 className="font-semibold">Employees</h2>
          <p className="text-sm">Upload and view employees list.</p>
        </div>
        <div className="p-4 bg-green-50 rounded shadow">
          <h2 className="font-semibold">Logs</h2>
          <p className="text-sm">Upload Scheduled Logs CSV.</p>
        </div>
        <div className="p-4 bg-purple-50 rounded shadow">
          <h2 className="font-semibold">Reports</h2>
          <p className="text-sm">Generate attendance summaries.</p>
        </div>
      </div>
    </div>
  );
}
