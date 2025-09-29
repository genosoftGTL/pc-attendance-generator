
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import UserForm from "../components/UserForm";
import UsersTable from "../components/UsersTable";
import { db } from "../lib/firebase";

export default async function UsersPage() {
  const q = query(
    collection(db, "polymer_attendance_users"),
    orderBy("createdAt", "desc")
  );
  const snapshot = await getDocs(q);

  const users = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  }));

  return (
    <div className="p-6  text-black space-y-6">
      <h1 className="text-xl font-bold">Users</h1>

      <UserForm />

      <h2 className="text-lg font-semibold">Existing Users</h2>
      <UsersTable users={users} />
    </div>
  );
}
