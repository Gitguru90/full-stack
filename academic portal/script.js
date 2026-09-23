const API_URL = "https://jsonplaceholder.typicode.com/users";

const STORAGE_KEY = "studentPortalLocalStudents";

const academicData = {
  1: { course: "B.Tech", semester: 5, cgpa: 8.7 },
  2: { course: "BCA", semester: 3, cgpa: 9.1 },
  3: { course: "MCA", semester: 2, cgpa: 8.4 },
  4: { course: "BBA", semester: 4, cgpa: 8.8 },
  5: { course: "MBA", semester: 3, cgpa: 9.0 },
  6: { course: "B.Tech", semester: 6, cgpa: 8.2 },
  7: { course: "BCA", semester: 4, cgpa: 8.9 },
  8: { course: "MCA", semester: 1, cgpa: 8.6 },
  9: { course: "BBA", semester: 2, cgpa: 8.1 },
  10: { course: "MBA", semester: 4, cgpa: 9.2 }
};


/* =========================
   LOCAL STORAGE FUNCTIONS
========================= */

function getLocalStudents() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch (error) {
    return [];
  }
}

function saveLocalStudents(students) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(students));
}


/* =========================
   ACADEMIC DATA
========================= */

function getAcademic(id, student = null) {

  // Use academic information stored with a locally
  // created/edited student.
  if (student && student.academic) {
    return student.academic;
  }

  return academicData[id] || {
    course: "B.Tech",
    semester: 1,
    cgpa: 8.0
  };
}


/* =========================
   STUDENT TABLE
========================= */

function studentRow(student) {

  return `
    <tr>
      <td>${student.id}</td>
      <td>${student.name}</td>
      <td>${student.email}</td>
      <td>${student.phone}</td>
      <td>${student.address?.city || "-"}</td>
      <td>
        <button class="action view" onclick="viewStudent(${student.id})">
          View
        </button>

        <button class="action edit" onclick="editStudent(${student.id})">
          Edit
        </button>

        <button class="action delete" onclick="deleteStudent(${student.id})">
          Delete
        </button>
      </td>
    </tr>
  `;
}


/* =========================
   LOAD STUDENTS
========================= */

async function loadStudents() {

  const body = document.getElementById("studentTableBody");

  if (!body) return;

  try {

    const response = await fetch(API_URL);

    const apiStudents = await response.json();

    // Students created by the user are stored locally.
    const localStudents = getLocalStudents();

    // Combine API students and locally created students.
    const students = [...apiStudents, ...localStudents];

    window.students = students;

    renderStudents(students);

  } catch (error) {

    // Even if API fails, locally stored students
    // should still be visible.
    const localStudents = getLocalStudents();

    window.students = localStudents;

    if (localStudents.length > 0) {
      renderStudents(localStudents);
    } else {
      body.innerHTML =
        '<tr><td colspan="6" class="center">Unable to load students.</td></tr>';
    }
  }
}


/* =========================
   RENDER STUDENTS
========================= */

function renderStudents(students) {

  const body = document.getElementById("studentTableBody");

  if (!body) return;

  if (!students.length) {

    body.innerHTML =
      '<tr><td colspan="6" class="center">No students found.</td></tr>';

    return;
  }

  body.innerHTML = students.map(studentRow).join("");
}


/* =========================
   SEARCH
========================= */

function setupSearch() {

  const input = document.getElementById("searchInput");

  if (!input) return;

  input.addEventListener("input", () => {

    const term = input.value.toLowerCase().trim();

    const filteredStudents = (window.students || []).filter(student =>
      student.name.toLowerCase().includes(term)
    );

    renderStudents(filteredStudents);
  });
}


/* =========================
   VIEW STUDENT
========================= */

function viewStudent(id) {

  location.href = `details.html?id=${id}`;
}


/* =========================
   EDIT STUDENT
========================= */

function editStudent(id) {

  location.href = `edit-student.html?id=${id}`;
}


/* =========================
   DELETE STUDENT
========================= */

async function deleteStudent(id) {

  if (!confirm("Are you sure you want to delete this student?")) {
    return;
  }

  const numericId = Number(id);

  // Check whether this is a locally created student.
  const localStudents = getLocalStudents();

  const localStudent = localStudents.find(
    student => Number(student.id) === numericId
  );

  if (localStudent) {

    const updatedStudents = localStudents.filter(
      student => Number(student.id) !== numericId
    );

    saveLocalStudents(updatedStudents);

    window.students = (window.students || []).filter(
      student => Number(student.id) !== numericId
    );

    renderStudents(window.students);

    alert("Student deleted successfully.");

    return;
  }

  // Original API students continue using DELETE.
  try {

    const response = await fetch(`${API_URL}/${numericId}`, {
      method: "DELETE"
    });

    if (response.ok) {

      window.students = (window.students || []).filter(
        student => Number(student.id) !== numericId
      );

      renderStudents(window.students);

      alert("Student deleted successfully.");
    }

  } catch (error) {

    alert("Delete operation failed.");
  }
}


/* =========================
   ADD STUDENT
========================= */

function setupAddForm() {

  const form = document.getElementById("addStudentForm");

  if (!form) return;

  form.addEventListener("submit", async e => {

    e.preventDefault();

    const data = Object.fromEntries(
      new FormData(form).entries()
    );

    /*
      Your current add-student.html does not contain
      a city input field.

      Therefore we ask for the city here without
      changing your existing HTML/UI.
    */
    const city = prompt("Enter student's city:");

    if (city === null) {
      return;
    }

    const localStudents = getLocalStudents();

    /*
      API has IDs 1-10.
      Generate a new ID after the largest existing ID.
    */
    const allExistingIds = [
      ...Array.from({ length: 10 }, (_, i) => i + 1),
      ...localStudents.map(student => Number(student.id))
    ];

    const newId = Math.max(...allExistingIds, 0) + 1;

    /*
      Create the complete student object.
    */
    const newStudent = {

      id: newId,

      name: data.name,

      email: data.email,

      phone: data.phone,

      website: "student.edu",

      address: {
        city: city.trim() || "-"
      },

      academic: {
        course: data.course,
        semester: Number(data.semester),
        cgpa: Number(data.cgpa)
      }
    };

    try {

      /*
        Send the student to JSONPlaceholder as before.
        This keeps the original REST API demonstration.
      */
      const response = await fetch(API_URL, {

        method: "POST",

        headers: {
          "Content-Type": "application/json"
        },

        body: JSON.stringify(newStudent)
      });

      /*
        JSONPlaceholder returns a fake API object.
        We do not depend on its returned ID because
        it does not permanently save the student.
      */
      if (response.ok) {

        /*
          Save the complete student locally.
          This makes the student persistent in the browser.
        */
        localStudents.push(newStudent);

        saveLocalStudents(localStudents);

        alert(
          `Student added successfully! Student ID: ${newStudent.id}`
        );

        form.reset();

        location.href = "students.html";

      } else {

        alert("Unable to add student.");
      }

    } catch (error) {

      /*
        If the API is unavailable, still save the
        student locally so the project remains usable.
      */
      localStudents.push(newStudent);

      saveLocalStudents(localStudents);

      alert(
        `Student added locally! Student ID: ${newStudent.id}`
      );

      form.reset();

      location.href = "students.html";
    }
  });
}


/* =========================
   FIND STUDENT
========================= */

async function findStudentById(id) {

  const numericId = Number(id);

  // First check locally stored students.
  const localStudents = getLocalStudents();

  const localStudent = localStudents.find(
    student => Number(student.id) === numericId
  );

  if (localStudent) {
    return localStudent;
  }

  // Otherwise get the original API student.
  const response = await fetch(`${API_URL}/${numericId}`);

  if (!response.ok) {
    throw new Error("Student not found");
  }

  return await response.json();
}


/* =========================
   EDIT STUDENT
========================= */

async function loadEditStudent() {

  const form = document.getElementById("editStudentForm");

  if (!form) return;

  const id = new URLSearchParams(location.search).get("id");

  if (!id) return;

  try {

    const student = await findStudentById(id);

    const academic = getAcademic(
      Number(id),
      student
    );

    document.getElementById("editName").value =
      student.name || "";

    document.getElementById("editEmail").value =
      student.email || "";

    document.getElementById("editPhone").value =
      student.phone || "";

    document.getElementById("editCourse").value =
      academic.course || "B.Tech";

    document.getElementById("editSemester").value =
      academic.semester || 1;

    document.getElementById("editCgpa").value =
      academic.cgpa || 0;


    form.addEventListener("submit", async e => {

      e.preventDefault();

      const data = Object.fromEntries(
        new FormData(form).entries()
      );

      const numericId = Number(id);

      /*
        Check whether this student was created locally.
      */
      const localStudents = getLocalStudents();

      const localIndex = localStudents.findIndex(
        student => Number(student.id) === numericId
      );


      /* =========================
         UPDATE LOCAL STUDENT
      ========================= */

      if (localIndex !== -1) {

        const existingStudent = localStudents[localIndex];

        existingStudent.name = data.name;

        existingStudent.email = data.email;

        existingStudent.phone = data.phone;

        existingStudent.academic = {
          course: data.course,
          semester: Number(data.semester),
          cgpa: Number(data.cgpa)
        };

        /*
          Keep the existing city.
        */
        existingStudent.address =
          existingStudent.address || {};

        existingStudent.address.city =
          existingStudent.address.city || "-";

        localStudents[localIndex] = existingStudent;

        saveLocalStudents(localStudents);

        alert("Student updated successfully!");

        location.href = "students.html";

        return;
      }


      /* =========================
         UPDATE API STUDENT
      ========================= */

      const payload = {

        name: data.name,

        email: data.email,

        phone: data.phone,

        academic: {
          course: data.course,
          semester: Number(data.semester),
          cgpa: Number(data.cgpa)
        }
      };

      const update = await fetch(
        `${API_URL}/${numericId}`,
        {
          method: "PUT",

          headers: {
            "Content-Type": "application/json"
          },

          body: JSON.stringify(payload)
        }
      );

      if (update.ok) {

        /*
          Since JSONPlaceholder does not persist PUT
          operations, store the edited API student
          locally so the changes remain visible.
        */
        const originalStudent = await findStudentById(numericId);

        const updatedStudent = {
          ...originalStudent,

          name: data.name,

          email: data.email,

          phone: data.phone,

          academic: {
            course: data.course,
            semester: Number(data.semester),
            cgpa: Number(data.cgpa)
          }
        };

        /*
          Store edited API student separately.
        */
        const editedStudents =
          JSON.parse(
            localStorage.getItem("studentPortalEditedStudents")
          ) || [];

        const existingIndex = editedStudents.findIndex(
          student => Number(student.id) === numericId
        );

        if (existingIndex !== -1) {
          editedStudents[existingIndex] = updatedStudent;
        } else {
          editedStudents.push(updatedStudent);
        }

        localStorage.setItem(
          "studentPortalEditedStudents",
          JSON.stringify(editedStudents)
        );

        alert("Student updated successfully!");

        location.href = "students.html";
      }

    });

  } catch (error) {

    alert("Unable to load student.");
  }
}


/* =========================
   LOAD STUDENT DETAILS
========================= */

async function loadDetails() {

  const box = document.getElementById("studentDetails");

  if (!box) return;

  const id = new URLSearchParams(location.search).get("id");

  if (!id) {

    box.textContent = "Student not found.";

    return;
  }

  try {

    const numericId = Number(id);

    let student = await findStudentById(numericId);

    /*
      If an API student has previously been edited,
      use the locally stored edited version.
    */
    const editedStudents =
      JSON.parse(
        localStorage.getItem("studentPortalEditedStudents")
      ) || [];

    const editedStudent = editedStudents.find(
      item => Number(item.id) === numericId
    );

    if (editedStudent) {
      student = editedStudent;
    }

    const academic = getAcademic(
      numericId,
      student
    );

    box.innerHTML = `

      <h2>${student.name}</h2>

      <p>
        <strong>Student ID:</strong>
        ${student.id}
      </p>

      <p>
        <strong>Email:</strong>
        ${student.email}
      </p>

      <p>
        <strong>Phone:</strong>
        ${student.phone}
      </p>

      <p>
        <strong>Course:</strong>
        ${academic.course}
      </p>

      <p>
        <strong>Semester:</strong>
        ${academic.semester}
      </p>

      <p>
        <strong>CGPA:</strong>
        ${academic.cgpa}
      </p>

      <p>
        <strong>City:</strong>
        ${student.address?.city || "-"}
      </p>

      <p>
        <strong>Company:</strong>
        ${student.company?.name || "-"}
      </p>
    `;

  } catch (error) {

    box.textContent =
      "Unable to load student details.";
  }
}


/* =========================
   DASHBOARD
========================= */

async function loadDashboard() {

  const total = document.getElementById("totalStudents");

  const courses = document.getElementById("totalCourses");

  if (!total) return;

  try {

    const response = await fetch(API_URL);

    const apiStudents = await response.json();

    const localStudents = getLocalStudents();

    const students = [
      ...apiStudents,
      ...localStudents
    ];

    /*
      Total student count includes locally added students.
    */
    total.textContent = students.length;

    /*
      Course count includes courses of both
      API students and locally added students.
    */
    const allCourses = students.map(student => {

      const academic = getAcademic(
        Number(student.id),
        student
      );

      return academic.course;
    });

    courses.textContent =
      new Set(allCourses).size;

  } catch (error) {

    const localStudents = getLocalStudents();

    total.textContent = localStudents.length;

    const localCourses = localStudents.map(student =>
      student.academic?.course
    );

    courses.textContent =
      new Set(localCourses).size;
  }
}


/* =========================
   PAGE INITIALIZATION
========================= */

document.addEventListener("DOMContentLoaded", () => {

  loadDashboard();

  loadStudents();

  setupSearch();

  setupAddForm();

  loadEditStudent();

  loadDetails();

});