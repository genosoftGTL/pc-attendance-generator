"use client";

import { useState } from "react";

export default function PayrollFilters({ onExport }) {
  const [month, setMonth] = useState("");
  const [includeOvertime, setIncludeOvertime] = useState(true);
  const [includeHolidays, setIncludeHolidays] = useState(true);
  const [nightRate, setNightRate] = useState(true);

  const handleSubmit = e => {
    e.preventDefault();
    onExport({ month, includeOvertime, includeHolidays, nightRate });
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 border rounded bg-white shadow">
      <h2 className="font-bold mb-2">Payroll Export Filters</h2>

      <div className="mb-2">
        <label className="block text-sm">Month</label>
        <input
          type="month"
          className="w-full p-2 border rounded"
          value={month}
          onChange={e => setMonth(e.target.value)}
        />
      </div>

      <div className="mb-2 flex items-center">
        <input
          type="checkbox"
          checked={includeOvertime}
          onChange={() => setIncludeOvertime(!includeOvertime)}
          className="mr-2"
        />
        <label>Include Overtime</label>
      </div>

      <div className="mb-2 flex items-center">
        <input
          type="checkbox"
          checked={includeHolidays}
          onChange={() => setIncludeHolidays(!includeHolidays)}
          className="mr-2"
        />
        <label>Include Holidays</label>
      </div>

      <div className="mb-2 flex items-center">
        <input
          type="checkbox"
          checked={nightRate}
          onChange={() => setNightRate(!nightRate)}
          className="mr-2"
        />
        <label>Apply Night Rate</label>
      </div>

      <button
        type="submit"
        className="mt-2 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
      >
        Export Payroll
      </button>
    </form>
  );
}
