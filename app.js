// Simple in-memory store + JSON file API

const API_BASE = "http://localhost:3000";

function safeText(v) {
  if (typeof v !== "string") return "";
  return v.replace(/[<>]/g, "");
}

async function fetchJson(path, options) {
  const res = await fetch(API_BASE + path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const msg = await res.text();
    throw new Error(msg || "Request failed");
  }
  return res.json();
}

function fillTable(users) {
  const body = document.getElementById("user-body");
  body.innerHTML = "";
  users.forEach((u) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td data-label="ID">${u.id}</td>
      <td data-label="Name">${safeText(u.name)}</td>
      <td data-label="Email">${safeText(u.email)}</td>
      <td data-label="Age">${u.age}</td>
      <td data-label="Actions">
        <div class="row-actions">
          <button data-id="${u.id}" class="edit-btn">Edit</button>
          <button data-id="${u.id}" class="danger delete-btn">Delete</button>
        </div>
      </td>
    `;
    body.appendChild(tr);
  });
}

async function loadAll() {
  try {
    const users = await fetchJson("/users");
    fillTable(users);
    document.getElementById("search-result").textContent = "";
  } catch (e) {
    console.error(e);
    alert("Could not load users. Make sure server is running.");
  }
}

async function handleSubmit(e) {
  e.preventDefault();
  const idField = document.getElementById("user-id");
  const name = safeText(document.getElementById("name").value.trim());
  const email = safeText(document.getElementById("email").value.trim());
  const ageVal = document.getElementById("age").value.trim();
  const age = Number(ageVal);

  if (!name || !email || !ageVal || Number.isNaN(age) || age <= 0) {
    alert("Valid name, email, age lagbe.");
    return;
  }

  const payload = { name, email, age };
  const id = idField.value;

  try {
    if (id) {
      await fetchJson(`/users/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
    } else {
      await fetchJson("/users", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    }
    e.target.reset();
    idField.value = "";
    await loadAll();
  } catch (err) {
    alert(err.message);
  }
}

async function handleSearch() {
  const idVal = document.getElementById("search-id").value.trim();
  const info = document.getElementById("search-result");
  if (!idVal) {
    info.textContent = "ID din search er jonno.";
    return;
  }
  try {
    const user = await fetchJson(`/users/${idVal}`);
    info.textContent = `Found: ${user.id} - ${user.name} (${user.email})`;
    fillTable([user]);
  } catch (e) {
    info.textContent = "User pai nai.";
  }
}

function handleTableClick(e) {
  const editBtn = e.target.closest(".edit-btn");
  const delBtn = e.target.closest(".delete-btn");

  if (editBtn) {
    const id = editBtn.getAttribute("data-id");
    editUser(id);
  } else if (delBtn) {
    const id = delBtn.getAttribute("data-id");
    deleteUser(id);
  }
}

async function editUser(id) {
  try {
    const user = await fetchJson(`/users/${id}`);
    document.getElementById("user-id").value = user.id;
    document.getElementById("name").value = user.name;
    document.getElementById("email").value = user.email;
    document.getElementById("age").value = user.age;
    document.getElementById("search-result").textContent = `Editing user #${user.id}`;
  } catch (e) {
    alert("User load korte parlam na.");
  }
}

async function deleteUser(id) {
  if (!confirm("Sure delete korte chan?")) return;
  try {
    await fetchJson(`/users/${id}`, { method: "DELETE" });
    await loadAll();
  } catch (e) {
    alert("Delete fail hoise.");
  }
}

function wireEvents() {
  document
    .getElementById("user-form")
    .addEventListener("submit", handleSubmit);
  document
    .getElementById("reset-btn")
    .addEventListener("click", () => {
      document.getElementById("user-form").reset();
      document.getElementById("user-id").value = "";
      document.getElementById("search-result").textContent = "";
    });
  document
    .getElementById("search-btn")
    .addEventListener("click", handleSearch);
  document
    .getElementById("clear-search-btn")
    .addEventListener("click", loadAll);
  document
    .getElementById("user-body")
    .addEventListener("click", handleTableClick);
}

window.addEventListener("DOMContentLoaded", () => {
  wireEvents();
  loadAll();
});
