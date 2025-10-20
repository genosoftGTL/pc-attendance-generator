// components/AdjustmentsManager.js
"use client";
import { useEffect, useState } from "react";
import { db } from "../lib/firebase";
import { collection, addDoc, getDocs, deleteDoc, doc } from "firebase/firestore";

export default function AdjustmentsManager() {
  const [list, setList] = useState([]);
  const [type, setType] = useState("add_hours");
  const [scope, setScope] = useState("employee");
  const [employeeId, setEmployeeId] = useState("");
  const [date, setDate] = useState("");
  const [hours, setHours] = useState(0);
  const [reason, setReason] = useState("");

  useEffect(() => load(), []);

  async function load() {
    const snap = await getDocs(collection(db, "adjustments"));
    setList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }

  async function addAdjustment(e) {
    e.preventDefault();
    if (scope === "employee" && !employeeId) return alert("Employee ID required");
    await addDoc(collection(db, "adjustments"), {
      type, scope, employeeId: scope === "employee" ? employeeId : null,
      date: date || null, hours: parseFloat(hours), reason, createdAt: new Date()
    });
    setEmployeeId(""); setDate(""); setHours(0); setReason("");
    load();
  }

  async function remove(id) {
    if (!confirm("Remove adjustment?")) return;
    await deleteDoc(doc(db, "adjustments", id));
    load();
  }

  return (
    <div className="bg-white p-4 rounded shadow">
      <h3 className="font-semibold">Adjustments</h3>

      <form onSubmit={addAdjustment} className="grid grid-cols-6 gap-2 my-2">
        <select value={type} onChange={e => setType(e.target.value)} className="p-2 col-span-1 border">
          <option value="add_hours">Add Hours</option>
          <option value="subtract_hours">Subtract Hours</option>
          <option value="override_hours">Override Hours</option>
        </select>

        <select value={scope} onChange={e => setScope(e.target.value)} className="p-2 col-span-1 border">
          <option value="employee">Employee</option>
          <option value="global">All Employees</option>
        </select>

        <input placeholder="Employee ID" value={employeeId} onChange={e => setEmployeeId(e.target.value)} className="p-2 col-span-1 border" />

        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="p-2 col-span-1 border" />

        <input type="number" step="0.25" value={hours} onChange={e => setHours(e.target.value)} className="p-2 col-span-1 border" />

        <input placeholder="Reason" value={reason} onChange={e => setReason(e.target.value)} className="p-2 col-span-2 border" />

        <button className="px-3 py-2 bg-blue-600 text-white rounded col-span-1">Add</button>
      </form>

      <div className="mt-3">
        <h4 className="font-medium">Existing</h4>
        <ul className="space-y-1 text-sm">
          {list.map(a => (
            <li key={a.id} className="flex justify-between">
              <div>
                [{a.scope}] {a.type} {a.hours}h {a.date ? `on ${a.date}` : ""} {a.employeeId ? `=> ${a.employeeId}` : ""} — {a.reason}
              </div>
              <button onClick={() => remove(a.id)} className="text-red-600">Delete</button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
