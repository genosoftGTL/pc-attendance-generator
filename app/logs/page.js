
"use client";
import { useState, useEffect } from "react";
import Papa from "papaparse";
import { saveAs } from "file-saver";
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  doc,
  getDoc,
} from "firebase/firestore";
import { DateTime } from "luxon";
import { db } from "../lib/firebase";

export default function LogsPage() {
  const [rows, setRows] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [savedLogs, setSavedLogs] = useState([]);

  useEffect(() => {
    // Load saved logs list from Firebase
    const load = async () => {
      const qSnap = await getDocs(query(collection(db, "PCA logs"), orderBy("createdAt", "desc")));
      setSavedLogs(qSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    };
    load();
  }, []);

  const handleFile = (e) => {
    const file = e.target.files[0];
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        setRows(result.data);
        setFiltered(result.data);
      },
    });
  };

  // Apply filters
  const applyFilters = () => {
    let data = rows;

    if (employeeFilter) {
      data = data.filter(
        (r) =>
          (r["Employee ID"] && r["Employee ID"].includes(employeeFilter)) ||
          (r["First Name"] &&
            r["First Name"].toLowerCase().includes(employeeFilter.toLowerCase()))
      );
    }

    if (dateRange.start && dateRange.end) {
      const start = DateTime.fromISO(dateRange.start);
      const end = DateTime.fromISO(dateRange.end);

      data = data.filter((r) => {
        const ts = DateTime.fromFormat(
          `${r["Date"]} ${r["Time"]}`,
          "dd-MM-yyyy HH:mm"
        );
        return ts >= start && ts <= end;
      });
    }

    setFiltered(data);
  };

  // Detect open shifts
  const detectOpenShifts = () => {
    const byEmp = {};
    filtered.forEach((r) => {
      const empId = r["Employee ID"];
      if (!byEmp[empId]) byEmp[empId] = [];
      byEmp[empId].push(r);
    });

    const flagged = [];
    Object.entries(byEmp).forEach(([empId, logs]) => {
      const dates = {};
      logs.forEach((l) => {
        if (!dates[l["Date"]]) dates[l["Date"]] = [];
        dates[l["Date"]].push(l);
      });
      Object.entries(dates).forEach(([date, punches]) => {
        if (punches.length % 2 !== 0) {
          flagged.push({ empId, date, count: punches.length });
        }
      });
    });
    return flagged;
  };

  // Export cleaned logs to CSV
  const exportCSV = () => {
    const csv = Papa.unparse(filtered);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    saveAs(blob, "clean_logs.csv");
  };

  // Save logs to Firebase
  const saveLogs = async () => {
    if (!filtered.length) return alert("No logs to save");

    const firstDate = filtered[0]["Date"];
    const lastDate = filtered[filtered.length - 1]["Date"];

    const docRef = await addDoc(collection(db, "PCA logs"), {
      name: `Logs ${firstDate} - ${lastDate}`,
      startDate: firstDate,
      endDate: lastDate,
      rowCount: filtered.length,
      createdAt: new Date(),
    });

    // Could batch insert into a subcollection
    // For now just attach raw in one field (simpler for testing)
    await addDoc(collection(db, `PCA logs/${docRef.id}/entries`), {
      data: filtered,
    });

    alert("Logs saved to Firebase ✅");
  };

  return (
    <div className="bg-white text-black p-6 rounded shadow space-y-6">
      <h1 className="text-xl font-bold mb-4">Upload Scheduled Logs</h1>
      <input type="file" accept=".csv" onChange={handleFile} />

      {/* Filters */}
      <div className="flex gap-4 mt-4">
        <input
          type="text"
          placeholder="Filter by Employee ID or Name"
          value={employeeFilter}
          onChange={(e) => setEmployeeFilter(e.target.value)}
          className="p-2 border rounded"
        />
        <input
          type="date"
          value={dateRange.start}
          onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
          className="p-2 border rounded"
        />
        <input
          type="date"
          value={dateRange.end}
          onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
          className="p-2 border rounded"
        />
        <button
          onClick={applyFilters}
          className="px-4 py-2 bg-blue-600 text-white rounded"
        >
          Apply Filters
        </button>
      </div>

      {/* Open shifts warning */}
      {filtered.length > 0 && (
        <div className="mt-4">
          <h2 className="font-semibold">Open Shifts:</h2>
          {detectOpenShifts().length === 0 ? (
            <p className="text-sm text-green-600">All shifts closed ✅</p>
          ) : (
             <p className="text-sm text-red-600">{detectOpenShifts().length} shifts not closed</p>
            // <ul className="list-disc pl-6 text-sm text-red-600">
            //   {detectOpenShifts().map((s, i) => (
            //     <li key={i}>
            //       {s.empId} on {s.date} ({s.count} punches)
            //     </li>
            //   ))}
            // </ul>
          )}
        </div>
      )}

      {/* Actions */}
      {filtered.length > 0 && (
        <div className="flex gap-4 mt-4">
          <button
            onClick={exportCSV}
            className="px-4 py-2 bg-purple-600 text-white rounded"
          >
            Export CSV
          </button>
          <button
            onClick={saveLogs}
            className="px-4 py-2 bg-green-600 text-white rounded"
          >
            Save to Firebase
          </button>
        </div>
      )}

      {/* Preview Table */}
      {filtered.length > 0 && (
        <table className="mt-6 w-full border-collapse">
          <thead>
            <tr className="bg-gray-100">
              {Object.keys(filtered[0]).map((col) => (
                <th key={col} className="p-2 border">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 50).map((row, i) => (
              <tr key={i}>
                {Object.values(row).map((val, j) => (
                  <td key={j} className="p-2 border">
                    {val}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Saved Logs List */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold">Saved Logs</h2>
        <ul className="list-disc pl-6">
          {savedLogs.map((log) => (
            <li key={log.id}>
              {log.name} ({log.rowCount} rows)
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}


