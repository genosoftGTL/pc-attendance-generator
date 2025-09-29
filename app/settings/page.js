"use client";
import { useEffect, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
// import { db } from "../../lib/firebase";

export default function SettingsPage() {
  const [form, setForm] = useState({
    normalShift: 10,
    nightStart: "22:00",
    nightEnd: "06:00",
    transportAllowance: 20,
    attendanceAllowance: 10,
    holidays: [],
  });
  const [loading, setLoading] = useState(true);

  // Load settings
  useEffect(() => {
    const load = async () => {
      const snap = await getDoc(doc(db, "PCA Settings", "Attendance"));
      if (snap.exists()) setForm(snap.data());
      setLoading(false);
    };
    load();
  }, []);

  const handleSave = async () => {
    await setDoc(doc(db, "PCA Settings", "Attendance"), form, { merge: true });
    alert("Settings saved ✅");
  };

  if (loading) return <p>Loading...</p>;

  return (
    <div className="bg-white p-6 text-black rounded shadow space-y-4">
      <h1 className="text-xl font-bold">Settings</h1>

      <div>
        <label className="block text-sm">Normal Shift (hours)</label>
        <input
          type="number"
          value={form.normalShift}
          onChange={(e) => setForm({ ...form, normalShift: +e.target.value })}
          className="p-2 border rounded"
        />
      </div>

      <div>
        <label className="block text-sm">Night Start</label>
        <input
          type="time"
          value={form.nightStart}
          onChange={(e) => setForm({ ...form, nightStart: e.target.value })}
          className="p-2 border rounded"
        />
      </div>

      <div>
        <label className="block text-sm">Night End</label>
        <input
          type="time"
          value={form.nightEnd}
          onChange={(e) => setForm({ ...form, nightEnd: e.target.value })}
          className="p-2 border rounded"
        />
      </div>

      <div>
        <label className="block text-sm">Transport Allowance</label>
        <input
          type="number"
          value={form.transportAllowance}
          onChange={(e) => setForm({ ...form, transportAllowance: +e.target.value })}
          className="p-2 border rounded"
        />
      </div>

      <div>
        <label className="block text-sm">Attendance Allowance</label>
        <input
          type="number"
          value={form.attendanceAllowance}
          onChange={(e) => setForm({ ...form, attendanceAllowance: +e.target.value })}
          className="p-2 border rounded"
        />
      </div>

      <div>
        <label className="block text-sm">Holidays (comma separated)</label>
        <input
          type="text"
          value={form.holidays.join(",")}
          onChange={(e) =>
            setForm({ ...form, holidays: e.target.value.split(",").map((d) => d.trim()) })
          }
          className="p-2 border rounded w-full"
        />
      </div>

      <button
        onClick={handleSave}
        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        Save Settings
      </button>
    </div>
  );
}
