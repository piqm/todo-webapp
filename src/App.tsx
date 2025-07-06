import React, {
  useState,
  useEffect,
  createContext,
  useContext,
  useCallback,
} from "react";

// --- Constants ---
const BASE_URL = "http://localhost:5000";

// Task Status and Priority Mappings (from Swagger enum)
const TaskStatusMap = {
  0: "Pendiente",
  1: "En Proceso",
  2: "Completada",
  3: "Cancelada", // Added as per Swagger, though not explicitly used in UI yet
};

const TaskPriorityMap = {
  0: "Baja",
  1: "Media",
  2: "Alta",
};

// --- Contexts ---
const AuthContext = createContext(null);
const TaskContext = createContext(null);
const UserManagementContext = createContext(null); // New context for user management

// --- API Service Functions ---

const apiRequest = async (url, method = "GET", body = null, token = null) => {
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const config = {
    method,
    headers,
  };
  if (body) {
    config.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, config);
    if (!response.ok) {
      // Try to parse error data from response, or use status text
      const errorData = await response
        .json()
        .catch(() => ({ message: response.statusText }));
      throw new Error(
        errorData.message ||
          `Error en la solicitud: ${response.status} ${response.statusText}`
      );
    }

    // Check Content-Type header to determine how to parse the response
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      return await response.json();
    } else {
      // If not JSON, assume it's plain text (e.g., JWT token for login)
      return await response.text();
    }
  } catch (error) {
    console.error(`Error en la solicitud API (${method} ${url}):`, error);
    // Provide a more user-friendly message for network errors
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      throw new Error(
        "No se pudo conectar al servidor. Asegúrate de que el backend esté en ejecución en " +
          BASE_URL
      );
    }
    throw error;
  }
};

// --- Auth Provider Component ---
const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // Function to set user details and token from API response
  const setUserAndToken = useCallback((userData, jwtToken) => {
    const userRoles = userData.roles
      ? userData.roles.map((role) => role.name).filter(Boolean)
      : []; // Filter out null roles
    const newUser = {
      id: userData.id,
      email: userData.email,
      firstName: userData.firstName,
      lastName: userData.lastName,
      roles: userRoles,
    };
    setUser(newUser);
    setToken(jwtToken);
    localStorage.setItem("jwtToken", jwtToken);
    localStorage.setItem("currentUser", JSON.stringify(newUser));
  }, []);

  useEffect(() => {
    const storedToken = localStorage.getItem("jwtToken");
    const storedUser = localStorage.getItem("currentUser");
    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, [setUserAndToken]);

  const login = async (email, password) => {
    try {
      const response = await apiRequest(`${BASE_URL}/users/login`, "POST", {
        email,
        password,
      });

      if (
        response &&
        response.isSuccess &&
        response.value &&
        response.value.user &&
        response.value.token
      ) {
        setUserAndToken(response.value.user, response.value.token);
        return true;
      } else {
        throw new Error(
          response.errors?.[0]?.message || "Credenciales inválidas."
        );
      }
    } catch (error) {
      console.error("Fallo de inicio de sesión:", error.message);
      throw error;
    }
  };

  const register = async (email, firstName, lastName, password) => {
    try {
      await apiRequest(`${BASE_URL}/users/register`, "POST", {
        email,
        firstName,
        lastName,
        password,
      });
      return true;
    } catch (error) {
      console.error("Fallo de registro:", error.message);
      throw error;
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("jwtToken");
    localStorage.removeItem("currentUser");
  };

  const hasRole = useCallback(
    (requiredRoles) => {
      if (!user || !user.roles) return false;
      if (requiredRoles.includes("Any")) return true; // Special role for any logged-in user
      return requiredRoles.some((role) => user.roles.includes(role));
    },
    [user]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-gray-700 text-lg">Cargando autenticación...</div>
      </div>
    );
  }

  return (
    <AuthContext.Provider
      value={{ user, token, login, register, logout, hasRole }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// --- Task Provider Component ---
const TaskProvider = ({ children }) => {
  const { user, token, hasRole } = useContext(AuthContext);
  const { users: allUsers } = useContext(UserManagementContext); // Get all users from UserManagementContext
  const [tasks, setTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [errorTasks, setErrorTasks] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageSize, setpageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const fetchTasks = useCallback(async () => {
    if (!token || !user?.id) {
      // Ensure user ID is available
      setTasks([]);
      return;
    }
    setLoadingTasks(true);
    setErrorTasks(null);
    try {
      // Use the specific endpoint for user tasks with pagination parameters
      const response = await apiRequest(
        `${BASE_URL}/tasks/user/${user.id}?pageNumber=${pageNumber}&pageSize=${pageSize}`,
        "GET",
        null,
        token
      );
      // The API now returns an object with a 'tasks' array and pagination info.
      setTasks(response.tasks || []);
      setTotalCount(response.totalCount || 0);
      setTotalPages(response.totalPages || 0);
      setPageNumber(response.pageNumber || 1);
      setpageSize(response.pageSize || 10);
    } catch (error) {
      setErrorTasks(error.message);
      setTasks([]);
    } finally {
      setLoadingTasks(false);
    }
  }, [token, user, pageNumber, pageSize]); // Depend on pageNumber and pageSize to re-fetch when they change

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const addTask = async (
    title,
    description,
    assignedToEmployeeId,
    assignedToReviewerId,
    status,
    priority
  ) => {
    if (!token) return false;
    try {
      const newTaskData = {
        description: description,
        type: title, // Mapping title to 'type' as per Swagger schema
        status: status,
        employeeId: assignedToEmployeeId || null,
        reviewerId: assignedToReviewerId || null,
        priority: priority,
      };
      const createdTask = await apiRequest(
        `${BASE_URL}/tasks`,
        "POST",
        newTaskData,
        token
      );
      // After adding, re-fetch tasks to ensure pagination is correct
      fetchTasks();
      return true;
    } catch (error) {
      console.error("Fallo al agregar tarea:", error.message);
      setErrorTasks(error.message);
      return false;
    }
  };

  const updateTask = async (id, updatedFields) => {
    if (!token) return false;
    try {
      const updatedTaskData = { id, ...updatedFields };
      const updatedTask = await apiRequest(
        `${BASE_URL}/tasks`,
        "PATCH",
        updatedTaskData,
        token
      );
      setTasks((prevTasks) =>
        prevTasks.map((task) =>
          task.id === id ? { ...task, ...updatedTask } : task
        )
      );
      return true;
    } catch (error) {
      console.error("Fallo al actualizar tarea:", error.message);
      setErrorTasks(error.message);
      return false;
    }
  };

  const deleteTask = async (id) => {
    if (!token) return false;
    try {
      await apiRequest(`${BASE_URL}/tasks/${id}`, "DELETE", null, token);
      // After deleting, re-fetch tasks to ensure pagination is correct
      fetchTasks();
      return true;
    } catch (error) {
      console.error("Fallo al eliminar tarea:", error.message);
      setErrorTasks(error.message);
      return false;
    }
  };

  const updateTaskStatus = async (id, newStatus) => {
    if (!token) return false;
    try {
      const updatedTask = await apiRequest(
        `${BASE_URL}/tasks/status`,
        "PATCH",
        { id, status: newStatus },
        token
      );
      setTasks((prevTasks) =>
        prevTasks.map((task) =>
          task.id === id ? { ...task, status: updatedTask.status } : task
        )
      );
      return true;
    } catch (error) {
      console.error("Fallo al actualizar estado de la tarea:", error.message);
      setErrorTasks(error.message);
      return false;
    }
  };

  const assignTaskToEmployee = async (taskId, employeeId) => {
    if (!token) return false;
    try {
      const updatedTask = await apiRequest(
        `${BASE_URL}/tasks/assigning/employee`,
        "PATCH",
        { id: taskId, employeeId },
        token
      );
      setTasks((prevTasks) =>
        prevTasks.map((task) =>
          task.id === taskId
            ? { ...task, employeeId: updatedTask.employeeId }
            : task
        )
      );
      return true;
    } catch (error) {
      console.error("Fallo al asignar tarea al empleado:", error.message);
      setErrorTasks(error.message);
      return false;
    }
  };

  const assignTaskToSupervisor = async (taskId, reviewerId) => {
    if (!token) return false;
    try {
      const updatedTask = await apiRequest(
        `${BASE_URL}/tasks/assigning/supervisor`,
        "PATCH",
        { id: taskId, reviewerId },
        token
      );
      setTasks((prevTasks) =>
        prevTasks.map((task) =>
          task.id === taskId
            ? { ...task, reviewerId: updatedTask.reviewerId }
            : task
        )
      );
      return true;
    } catch (error) {
      console.error("Fallo al asignar tarea al supervisor:", error.message);
      setErrorTasks(error.message);
      return false;
    }
  };

  // Filter tasks based on user roles
  const getFilteredTasks = useCallback(() => {
    if (!user) return [];
    if (hasRole(["administrador"])) {
      return tasks; // Admin sees all tasks
    } else if (hasRole(["supervisor"])) {
      // Supervisor sees tasks assigned to them as reviewer or tasks assigned to their employees
      return tasks.filter(
        (task) =>
          task.reviewerId === user.id ||
          allUsers.some(
            (u) => u.id === task.employeeId && u.roles.includes("empleado")
          )
      );
    } else if (hasRole(["empleado"])) {
      return tasks.filter((task) => task.employeeId === user.id); // Employee sees only their tasks
    }
    return [];
  }, [tasks, user, hasRole, allUsers]);

  return (
    <TaskContext.Provider
      value={{
        tasks: getFilteredTasks(),
        loadingTasks,
        errorTasks,
        addTask,
        updateTask,
        deleteTask,
        updateTaskStatus,
        assignTaskToEmployee,
        assignTaskToSupervisor,
        fetchTasks, // Expose fetchTasks for re-fetching when needed
        pageNumber,
        pageSize,
        totalCount,
        totalPages,
        setPageNumber,
        setpageSize,
      }}
    >
      {children}
    </TaskContext.Provider>
  );
};

// --- User Management Provider (New) ---
const UserManagementProvider = ({ children }) => {
  const { token, hasRole, user, setUser } = useContext(AuthContext); // Added user and setUser from AuthContext
  const [users, setUsers] = useState([]); // This will hold the list of users for management
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [errorUsers, setErrorUsers] = useState(null);

  // Mock roles for assignment dropdown
  const availableRoles = ["administrador", "supervisor", "empleado"]; // Use lowercase names as returned by API

  // Fetch users from the backend
  const fetchUsers = useCallback(async () => {
    if (!token || !hasRole(["administrador"])) {
      setUsers([]);
      return;
    }
    setLoadingUsers(true);
    setErrorUsers(null);
    try {
      const response = await apiRequest(
        `${BASE_URL}/users`,
        "GET",
        null,
        token
      );
      if (response && response.isSuccess && response.value) {
        // Map roles from the backend structure { id, name, description } to just name
        const fetchedUsers = response.value.map((u) => ({
          ...u,
          roles: u.roles
            ? u.roles.map((role) => role.name).filter(Boolean)
            : [], // Filter out null roles
        }));
        setUsers(fetchedUsers);
      } else {
        throw new Error(
          response.errors?.[0]?.message || "Fallo al obtener usuarios."
        );
      }
    } catch (error) {
      setErrorUsers(error.message);
      setUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  }, [token, hasRole]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const createUser = async (email, firstName, lastName, password) => {
    if (!token || !hasRole(["administrador"])) return false;
    try {
      const newUser = await apiRequest(`${BASE_URL}/users/register`, "POST", {
        email,
        firstName,
        lastName,
        password,
      });
      // After creating, re-fetch users to update the list
      fetchUsers();
      return newUser;
    } catch (error) {
      console.error("Fallo al crear usuario:", error.message);
      setErrorUsers(error.message);
      throw error;
    }
  };

  const updateUser = async (id, email, firstName, lastName) => {
    if (!token || !hasRole(["administrador"])) return false;
    try {
      const updatedUser = await apiRequest(
        `${BASE_URL}/users`,
        "PATCH",
        { id, email, firstName, lastName },
        token
      );
      setUsers((prevUsers) =>
        prevUsers.map((u) =>
          u.id === id
            ? {
                ...u,
                ...updatedUser,
                roles: updatedUser.roles
                  ? updatedUser.roles.map((role) => role.name).filter(Boolean)
                  : [],
              }
            : u
        )
      );
      return true;
    } catch (error) {
      console.error("Fallo al actualizar usuario:", error.message);
      setErrorUsers(error.message);
      return false;
    }
  };

  const deleteUser = async (id) => {
    if (!token || !hasRole(["administrador"])) return false;
    try {
      await apiRequest(`${BASE_URL}/users/${id}`, "DELETE", null, token);
      setUsers((prevUsers) => prevUsers.filter((user) => user.id !== id));
      return true;
    } catch (error) {
      console.error("Fallo al eliminar usuario:", error.message);
      setErrorUsers(error.message);
      return false;
    }
  };

  const assignRolesToUser = async (userId, roles) => {
    if (!token || !hasRole(["administrador"])) return false;
    try {
      // Assuming a simple mapping for demo:
      const mockRoleIds = {
        administrador: "74eddc48-9a0d-418f-b074-c3867db03b31",
        supervisor: "fab11349-cc21-4e73-ad24-27e8e78a4650",
        empleado: "219cb681-2ec3-4a9a-8c69-4d94b40a28fe",
      };
      const roleUuids = roles
        .map((roleName) => mockRoleIds[roleName.toLowerCase()])
        .filter(Boolean); // Convert role name to lowercase for mapping

      const response = await apiRequest(
        `${BASE_URL}/users/roles`,
        "POST",
        { userId, roles: roleUuids },
        token
      );
      if (response && response.isSuccess && response.value) {
        const updatedUser = response.value;
        // Update the user in the local state with new roles
        setUsers((prevUsers) =>
          prevUsers.map((u) =>
            u.id === userId
              ? {
                  ...u,
                  roles: updatedUser.roles
                    ? updatedUser.roles.map((role) => role.name).filter(Boolean)
                    : [],
                }
              : u
          )
        );
        // If the currently logged-in user's roles change, update AuthContext
        if (user && user.id === userId) {
          setUser((prevUser) => ({
            ...prevUser,
            roles: updatedUser.roles
              ? updatedUser.roles.map((role) => role.name).filter(Boolean)
              : [],
          }));
        }
      } else {
        throw new Error(
          response.errors?.[0]?.message || "Fallo al asignar roles."
        );
      }
      return true;
    } catch (error) {
      console.error("Fallo al asignar roles:", error.message);
      setErrorUsers(error.message);
      return false;
    }
  };

  return (
    <UserManagementContext.Provider
      value={{
        users,
        loadingUsers,
        errorUsers,
        availableRoles,
        fetchUsers,
        createUser,
        updateUser,
        deleteUser,
        assignRolesToUser,
      }}
    >
      {children}
    </UserManagementContext.Provider>
  );
};

// --- Components ---

const RegisterPage = ({ onRegisterSuccess, onGoToLogin }) => {
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { register } = useContext(AuthContext);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await register(email, firstName, lastName, password);
      onRegisterSuccess();
    } catch (err) {
      setError(err.message || "Fallo el registro.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-purple-500 to-pink-600">
      <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-md transform transition-all duration-300 hover:scale-105">
        <h2 className="text-4xl font-extrabold text-center text-gray-800 mb-8">
          Registrarse
        </h2>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label
              htmlFor="reg-email"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Correo Electrónico
            </label>
            <input
              type="email"
              id="reg-email"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition duration-200 ease-in-out"
              placeholder="tu@ejemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label
              htmlFor="reg-firstName"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Nombre
            </label>
            <input
              type="text"
              id="reg-firstName"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition duration-200 ease-in-out"
              placeholder="Juan"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
            />
          </div>
          <div>
            <label
              htmlFor="reg-lastName"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Apellido
            </label>
            <input
              type="text"
              id="reg-lastName"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition duration-200 ease-in-out"
              placeholder="Pérez"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
            />
          </div>
          <div>
            <label
              htmlFor="reg-password"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Contraseña
            </label>
            <input
              type="password"
              id="reg-password"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition duration-200 ease-in-out"
              placeholder="********"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-red-600 text-sm text-center">{error}</p>}
          <button
            type="submit"
            className="w-full bg-purple-600 text-white py-3 rounded-lg font-semibold text-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition duration-300 ease-in-out transform hover:-translate-y-1"
            disabled={loading}
          >
            {loading ? "Registrando..." : "Registrarse"}
          </button>
        </form>
        <p className="mt-6 text-center text-gray-600 text-sm">
          ¿Ya tienes una cuenta?{" "}
          <button
            onClick={onGoToLogin}
            className="text-purple-600 hover:underline font-semibold"
          >
            Iniciar Sesión
          </button>
        </p>
      </div>
    </div>
  );
};

const LoginPage = ({ onLoginSuccess, onGoToRegister }) => {
  const [email, setEmail] = useState("todo@mail.com");
  const [password, setPassword] = useState("todo123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useContext(AuthContext);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const success = await login(email, password);
      if (success) {
        onLoginSuccess();
      }
    } catch (err) {
      setError(
        err.message ||
          "Fallo el inicio de sesión. Por favor, verifica tus credenciales o el estado del servidor."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen w-full bg-gradient-to-br from-white to-blue-300 p-4">
      {" "}
      <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-md transform transition-all duration-300 hover:scale-105">
        <h2 className="text-4xl font-extrabold text-center text-gray-800 mb-8">
          ¡Bienvenido de nuevo!
        </h2>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Correo Electrónico
            </label>
            <select
              id="email"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition duration-200 ease-in-out"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            >
              <option value="todo@mail.com">todo@mail.com</option>
              <option value="todo1@mail.com">todo1@mail.com</option>
              <option value="todo2@mail.com">todo2@mail.com</option>
            </select>
          </div>
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Contraseña
            </label>
            <input
              type="password"
              id="password"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition duration-200 ease-in-out"
              placeholder="todo123"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-red-600 text-sm text-center">{error}</p>}
          <button
            type="submit"
            className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold text-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition duration-300 ease-in-out transform hover:-translate-y-1"
            disabled={loading}
          >
            {loading ? "Iniciando sesión..." : "Iniciar Sesión"}
          </button>
        </form>
        <p className="mt-6 text-center text-gray-600 text-sm">
          ¿No tienes una cuenta?{" "}
          <button
            onClick={onGoToRegister}
            className="text-indigo-600 hover:underline font-semibold"
          >
            Registrarse
          </button>
        </p>
      </div>
    </div>
  );
};

const TaskForm = ({ onAddTask }) => {
  const { users } = useContext(UserManagementContext); // Use users from UserManagementContext
  const { hasRole } = useContext(AuthContext);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignedToEmployeeId, setAssignedToEmployeeId] = useState("");
  const [assignedToReviewerId, setAssignedToReviewerId] = useState("");
  const [status, setStatus] = useState(TaskStatusMap[0]); // Default to Pending
  const [priority, setPriority] = useState(TaskPriorityMap[0]); // Default to Low

  // Filter users by role for assignment dropdowns
  const employees = users.filter((u) => u.roles.includes("empleado"));
  const supervisors = users.filter((u) => u.roles.includes("supervisor"));

  useEffect(() => {
    if (employees.length > 0 && !assignedToEmployeeId) {
      setAssignedToEmployeeId(employees[0].id);
    }
    if (supervisors.length > 0 && !assignedToReviewerId) {
      setAssignedToReviewerId(supervisors[0].id);
    }
  }, [employees, supervisors, assignedToEmployeeId, assignedToReviewerId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    // Convert status and priority strings back to their numeric enum values
    const statusValue = Object.keys(TaskStatusMap).find(
      (key) => TaskStatusMap[key] === status
    );
    const priorityValue = Object.keys(TaskPriorityMap).find(
      (key) => TaskPriorityMap[key] === priority
    );

    const success = await onAddTask(
      title,
      description,
      assignedToEmployeeId,
      assignedToReviewerId,
      parseInt(statusValue),
      parseInt(priorityValue)
    );
    if (success) {
      setTitle("");
      setDescription("");
      setAssignedToEmployeeId(employees[0]?.id || "");
      setAssignedToReviewerId(supervisors[0]?.id || "");
      setStatus(TaskStatusMap[0]);
      setPriority(TaskPriorityMap[0]);
    }
  };

  if (!hasRole(["administrador", "supervisor"])) {
    return null; // Only Admins and Supervisors can add tasks
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white p-6 rounded-xl shadow-lg mb-8 space-y-4"
    >
      <h3 className="text-2xl font-bold text-gray-800 mb-4">
        Añadir Nueva Tarea
      </h3>
      <div>
        <label
          htmlFor="task-title"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Título de la Tarea
        </label>
        <input
          type="text"
          id="task-title"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
          placeholder="Ej: Comprar víveres"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </div>
      <div>
        <label
          htmlFor="task-description"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Descripción (Opcional)
        </label>
        <textarea
          id="task-description"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
          rows="3"
          placeholder="Ej: Leche, huevos, pan y frutas"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        ></textarea>
      </div>
      <div>
        <label
          htmlFor="task-status"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Estado
        </label>
        <select
          id="task-status"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          {Object.values(TaskStatusMap).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label
          htmlFor="task-priority"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Prioridad
        </label>
        <select
          id="task-priority"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
        >
          {Object.values(TaskPriorityMap).map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>
      {hasRole(["administrador", "supervisor"]) && (
        <>
          <div>
            <label
              htmlFor="assigned-employee"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Asignar a Empleado
            </label>
            <select
              id="assigned-employee"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
              value={assignedToEmployeeId}
              onChange={(e) => setAssignedToEmployeeId(e.target.value)}
            >
              <option value="">Seleccionar Empleado</option>
              {employees.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.firstName} {user.lastName} ({user.email})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="assigned-reviewer"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Asignar a Supervisor (Revisor)
            </label>
            <select
              id="assigned-reviewer"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
              value={assignedToReviewerId}
              onChange={(e) => setAssignedToReviewerId(e.target.value)}
            >
              <option value="">Seleccionar Supervisor</option>
              {supervisors.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.firstName} {user.lastName} ({user.email})
                </option>
              ))}
            </select>
          </div>
        </>
      )}
      <button
        type="submit"
        className="w-full bg-indigo-600 text-white py-2 rounded-lg font-semibold hover:bg-indigo-700 transition duration-200 ease-in-out transform hover:-translate-y-0.5"
      >
        Añadir Tarea
      </button>
    </form>
  );
};

const TaskItem = ({ task }) => {
  const { users } = useContext(UserManagementContext); // Use users from UserManagementContext
  const {
    updateTask,
    deleteTask,
    updateTaskStatus,
    assignTaskToEmployee,
    assignTaskToSupervisor,
  } = useContext(TaskContext);
  const { hasRole } = useContext(AuthContext);

  // Directly use employee and reviewer data from the task object if available
  const employeeName = task.employee
    ? `${task.employee.firstName} ${task.employee.lastName}`
    : "N/A";
  const reviewerName = task.reviewer
    ? `${task.reviewer.firstName} ${task.reviewer.lastName}`
    : "N/A";

  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(task.type);
  const [editedDescription, setEditedDescription] = useState(task.description);
  const [editedStatus, setEditedStatus] = useState(TaskStatusMap[task.status]);
  const [editedPriority, setEditedPriority] = useState(
    TaskPriorityMap[task.priority]
  );
  const [editedEmployeeId, setEditedEmployeeId] = useState(
    task.employeeId || ""
  );
  const [editedReviewerId, setEditedReviewerId] = useState(
    task.reviewerId || ""
  );

  const employees = users.filter((u) => u.roles.includes("empleado"));
  const supervisors = users.filter((u) => u.roles.includes("supervisor"));

  const handleSave = async () => {
    const statusValue = Object.keys(TaskStatusMap).find(
      (key) => TaskStatusMap[key] === editedStatus
    );
    const priorityValue = Object.keys(TaskPriorityMap).find(
      (key) => TaskPriorityMap[key] === editedPriority
    );

    const success = await updateTask(task.id, {
      type: editedTitle,
      description: editedDescription,
      status: parseInt(statusValue),
      priority: parseInt(priorityValue),
      employeeId: editedEmployeeId,
      reviewerId: editedReviewerId,
    });
    if (success) {
      setIsEditing(false);
    }
  };

  const handleStatusChange = async (e) => {
    const newStatus = parseInt(e.target.value);
    await updateTaskStatus(task.id, newStatus);
  };

  const canEdit = hasRole(["administrador"]);
  const canChangeStatus = hasRole(["administrador", "supervisor", "empleado"]);
  const canAssign = hasRole(["administrador", "supervisor"]);
  const canDelete = hasRole(["administrador"]);

  return (
    <div
      className={`bg-white p-6 rounded-xl shadow-md flex flex-col md:flex-row items-start md:items-center justify-between transition duration-300 ease-in-out transform hover:scale-[1.01] ${
        task.status === 2
          ? "opacity-60 border-l-8 border-green-500"
          : "border-l-8 border-indigo-500"
      }`}
    >
      {isEditing && canEdit ? (
        <div className="flex-1 w-full space-y-3">
          <input
            type="text"
            value={editedTitle}
            onChange={(e) => setEditedTitle(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 text-lg font-semibold"
          />
          <textarea
            value={editedDescription}
            onChange={(e) => setEditedDescription(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 text-sm"
            rows="2"
          ></textarea>
          <select
            value={editedStatus}
            onChange={(e) => setEditedStatus(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
          >
            {Object.values(TaskStatusMap).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            value={editedPriority}
            onChange={(e) => setEditedPriority(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
          >
            {Object.values(TaskPriorityMap).map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          {canAssign && (
            <>
              <select
                value={editedEmployeeId}
                onChange={(e) => setEditedEmployeeId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">Seleccionar Empleado</option>
                {employees.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.firstName} {user.lastName} ({user.email})
                  </option>
                ))}
              </select>
              <select
                value={editedReviewerId}
                onChange={(e) => setEditedReviewerId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">Seleccionar Supervisor</option>
                {supervisors.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.firstName} {user.lastName} ({user.email})
                  </option>
                ))}
              </select>
            </>
          )}
          <button
            onClick={handleSave}
            className="mt-2 bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition duration-200"
          >
            Guardar
          </button>
        </div>
      ) : (
        <div className="flex-1">
          <h4
            className={`text-lg font-semibold ${
              task.status === 2 ? "line-through text-gray-500" : "text-gray-800"
            }`}
          >
            {task.type}
          </h4>
          {task.description && (
            <p
              className={`text-sm text-gray-600 mt-1 ${
                task.status === 2 ? "line-through" : ""
              }`}
            >
              {task.description}
            </p>
          )}
          <p className="text-xs text-gray-500 mt-2">
            Estado:{" "}
            <span className="font-medium">{TaskStatusMap[task.status]}</span> |
            Prioridad:{" "}
            <span className="font-medium">
              {TaskPriorityMap[task.priority]}
            </span>
          </p>
          <p className="text-xs text-gray-500">
            Asignado a Empleado:{" "}
            <span className="font-medium">{employeeName}</span>
          </p>
          <p className="text-xs text-gray-500">
            Asignado a Supervisor:{" "}
            <span className="font-medium">{reviewerName}</span>
          </p>
          <p className="text-xs text-gray-400">
            Creado: {new Date(task.createdOnUtc).toLocaleDateString()}
          </p>
        </div>
      )}

      <div className="flex space-x-2 mt-4 md:mt-0 md:ml-4">
        {canChangeStatus && (
          <select
            value={task.status}
            onChange={handleStatusChange}
            className={`p-2 rounded-lg text-sm font-medium ${
              task.status === 2
                ? "bg-green-500 text-white"
                : "bg-gray-200 text-gray-800"
            } focus:ring-indigo-500 focus:border-indigo-500 transition duration-200`}
            title="Cambiar Estado"
          >
            {Object.entries(TaskStatusMap).map(([key, value]) => (
              <option key={key} value={key}>
                {value}
              </option>
            ))}
          </select>
        )}

        {canEdit && (
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="p-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition duration-200"
            title="Editar Tarea"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
              />
            </svg>
          </button>
        )}
        {canDelete && (
          <button
            onClick={() => deleteTask(task.id)}
            className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition duration-200"
            title="Eliminar Tarea"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};

const UserManagementPage = () => {
  const {
    users,
    loadingUsers,
    errorUsers,
    availableRoles,
    fetchUsers,
    createUser,
    updateUser,
    deleteUser,
    assignRolesToUser,
  } = useContext(UserManagementContext);
  const { hasRole } = useContext(AuthContext);

  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [showAssignRolesModal, setShowAssignRolesModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  const [newEmail, setNewEmail] = useState("");
  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [addUserError, setAddUserError] = useState("");

  const [editEmail, setEditEmail] = useState("");
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editUserError, setEditUserError] = useState("");

  const [selectedRoles, setSelectedRoles] = useState([]);
  const [assignRolesError, setAssignRolesError] = useState("");

  useEffect(() => {
    if (selectedUser) {
      setEditEmail(selectedUser.email || "");
      setEditFirstName(selectedUser.firstName || "");
      setEditLastName(selectedUser.lastName || "");
      setSelectedRoles(selectedUser.roles || []);
    }
  }, [selectedUser]);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setAddUserError("");
    try {
      await createUser(newEmail, newFirstName, newLastName, newPassword);
      setShowAddUserModal(false);
      setNewEmail("");
      setNewFirstName("");
      setNewLastName("");
      setNewPassword("");
    } catch (error) {
      setAddUserError(error.message || "Fallo al crear usuario.");
    }
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    setEditUserError("");
    if (!selectedUser) return;
    try {
      await updateUser(selectedUser.id, editEmail, editFirstName, editLastName);
      setShowEditUserModal(false);
      setSelectedUser(null);
    } catch (error) {
      setEditUserError(error.message || "Fallo al actualizar usuario.");
    }
  };

  const handleAssignRoles = async (e) => {
    e.preventDefault();
    setAssignRolesError("");
    if (!selectedUser) return;
    try {
      await assignRolesToUser(selectedUser.id, selectedRoles);
      setShowAssignRolesModal(false);
      setSelectedUser(null);
    } catch (error) {
      setAssignRolesError(error.message || "Fallo al asignar roles.");
    }
  };

  if (!hasRole(["administrador"])) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-red-100 text-red-700 text-xl font-semibold">
        Acceso Denegado: No tienes privilegios de Administrador.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 to-pink-200 p-4 sm:p-6 lg:p-8">
      <h2 className="text-3xl font-bold text-gray-800 mb-6">
        Gestión de Usuarios
      </h2>

      <button
        onClick={() => setShowAddUserModal(true)}
        className="mb-6 bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 transition duration-200 ease-in-out transform hover:-translate-y-0.5"
      >
        Añadir Nuevo Usuario
      </button>

      {loadingUsers && <p className="text-gray-700">Cargando usuarios...</p>}
      {errorUsers && <p className="text-red-600">Error: {errorUsers}</p>}

      <div className="bg-white p-6 rounded-xl shadow-lg overflow-x-auto">
        {" "}
        {/* Added overflow-x-auto here */}
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Correo Electrónico
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Nombre
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Roles
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.map((user) => (
              <tr key={user.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {user.email}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {user.firstName} {user.lastName}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {user.roles && user.roles.length > 0
                    ? user.roles.join(", ")
                    : "Sin Roles"}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    onClick={() => {
                      setSelectedUser(user);
                      setShowEditUserModal(true);
                    }}
                    className="text-indigo-600 hover:text-indigo-900 mr-3"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => {
                      setSelectedUser(user);
                      setShowAssignRolesModal(true);
                    }}
                    className="text-purple-600 hover:text-purple-900 mr-3"
                  >
                    Asignar Roles
                  </button>
                  <button
                    onClick={() => deleteUser(user.id)}
                    className="text-red-600 hover:text-red-900"
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add User Modal */}
      {showAddUserModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-xl shadow-xl w-full max-w-md">
            <h3 className="text-2xl font-bold mb-6 text-gray-800">
              Añadir Nuevo Usuario
            </h3>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Correo Electrónico
                </label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  required
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Nombre
                </label>
                <input
                  type="text"
                  value={newFirstName}
                  onChange={(e) => setNewFirstName(e.target.value)}
                  required
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Apellido
                </label>
                <input
                  type="text"
                  value={newLastName}
                  onChange={(e) => setNewLastName(e.target.value)}
                  required
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Contraseña
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                />
              </div>
              {addUserError && (
                <p className="text-red-600 text-sm">{addUserError}</p>
              )}
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                >
                  Crear Usuario
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditUserModal && selectedUser && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-xl shadow-xl w-full max-w-md">
            <h3 className="text-2xl font-bold mb-6 text-gray-800">
              Editar Usuario
            </h3>
            <form onSubmit={handleUpdateUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Correo Electrónico
                </label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  required
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Nombre
                </label>
                <input
                  type="text"
                  value={editFirstName}
                  onChange={(e) => setEditFirstName(e.target.value)}
                  required
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Apellido
                </label>
                <input
                  type="text"
                  value={editLastName}
                  onChange={(e) => setNewLastName(e.target.value)}
                  required
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                />
              </div>
              {editUserError && (
                <p className="text-red-600 text-sm">{editUserError}</p>
              )}
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowEditUserModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Roles Modal */}
      {showAssignRolesModal && selectedUser && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-xl shadow-xl w-full max-w-md">
            <h3 className="text-2xl font-bold mb-6 text-gray-800">
              Asignar Roles a {selectedUser.firstName}
            </h3>
            <form onSubmit={handleAssignRoles} className="space-y-4">
              {availableRoles.map((role) => (
                <div key={role} className="flex items-center">
                  <input
                    type="checkbox"
                    id={`role-${role}`}
                    checked={selectedRoles.includes(role)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedRoles([...selectedRoles, role]);
                      } else {
                        setSelectedRoles(
                          selectedRoles.filter((r) => r !== role)
                        );
                      }
                    }}
                    className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                  />
                  <label
                    htmlFor={`role-${role}`}
                    className="ml-2 block text-sm text-gray-900"
                  >
                    {role}
                  </label>
                </div>
              ))}
              {assignRolesError && (
                <p className="text-red-600 text-sm">{assignRolesError}</p>
              )}
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowAssignRolesModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
                >
                  Asignar Roles
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const DashboardPage = () => {
  const { user, logout, hasRole } = useContext(AuthContext);
  const {
    tasks,
    addTask,
    loadingTasks,
    errorTasks,
    pageNumber,
    pageSize,
    totalCount,
    totalPages,
    setPageNumber,
    setpageSize,
  } = useContext(TaskContext);

  const sortedTasks = [...tasks].sort(
    (a, b) =>
      new Date(b.createdOnUtc).getTime() - new Date(a.createdOnUtc).getTime()
  );

  const handlePreviousPage = () => {
    if (pageNumber > 1) {
      setPageNumber(pageNumber - 1);
    }
  };

  const handleNextPage = () => {
    if (pageNumber < totalPages) {
      setPageNumber(pageNumber + 1);
    }
  };

  const handlePageSizeChange = (e) => {
    setpageSize(parseInt(e.target.value));
    setPageNumber(1); // Reset to first page when page size changes
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 to-indigo-200 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-col sm:flex-row items-center justify-between bg-white p-6 rounded-xl shadow-lg mb-8">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-800 mb-4 sm:mb-0">
          ¡Bienvenido, {user?.firstName || "Invitado"}!
        </h1>
        <div className="text-gray-600 text-sm sm:text-base mr-4">
          <p>
            Email: <span className="font-semibold">{user?.email}</span>
          </p>
          <p>
            Roles:{" "}
            <span className="font-semibold">
              {user?.roles?.join(", ") || "N/A"}
            </span>
          </p>
        </div>
        <div className="flex space-x-4">
          {hasRole(["administrador"]) && (
            <button
              onClick={() => window.setCurrentPage("user-management")} // Simulate navigation
              className="bg-purple-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-purple-700 transition duration-200 ease-in-out transform hover:-translate-y-0.5"
            >
              Gestión de Usuarios
            </button>
          )}
          <button
            onClick={logout}
            className="bg-red-500 text-white px-6 py-2 rounded-lg font-semibold hover:bg-red-600 transition duration-200 ease-in-out transform hover:-translate-y-0.5"
          >
            Cerrar Sesión
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {hasRole(["administrador", "supervisor"]) && (
          <div className="lg:col-span-1">
            <TaskForm onAddTask={addTask} />
          </div>
        )}
        <div
          className={
            hasRole(["administrador", "supervisor"])
              ? "lg:col-span-2"
              : "lg:col-span-3"
          }
        >
          <h2 className="text-3xl font-bold text-gray-800 mb-6">Tus Tareas</h2>
          {loadingTasks && <p className="text-gray-700">Cargando tareas...</p>}
          {errorTasks && <p className="text-red-600">Error: {errorTasks}</p>}
          {!loadingTasks && !errorTasks && sortedTasks.length === 0 ? (
            <p className="text-gray-600 text-lg bg-white p-6 rounded-xl shadow-lg">
              ¡Aún no hay tareas!{" "}
              {hasRole(["administrador", "supervisor"]) &&
                "Añade una usando el formulario de la izquierda."}
            </p>
          ) : (
            <>
              <div className="space-y-6">
                {sortedTasks.map((task) => (
                  <TaskItem key={task.id} task={task} />
                ))}
              </div>
              {/* Pagination Controls */}
              <div className="flex flex-col sm:flex-row items-center justify-between mt-8 bg-white p-4 rounded-xl shadow-lg flex-wrap gap-2">
                <button
                  onClick={handlePreviousPage}
                  disabled={pageNumber === 1}
                  className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition duration-200"
                >
                  Anterior
                </button>
                <span className="text-gray-700 text-center">
                  Página {pageNumber} de {totalPages} (Total: {totalCount}{" "}
                  tareas)
                </span>
                <select
                  value={pageSize}
                  onChange={handlePageSizeChange}
                  className="p-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="5">5 por página</option>
                  <option value="10">10 por página</option>
                  <option value="20">20 por página</option>
                </select>
                <button
                  onClick={handleNextPage}
                  disabled={pageNumber === totalPages}
                  className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition duration-200"
                >
                  Siguiente
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// --- Main App Component ---
const App = () => {
  const { user, hasRole } = useContext(AuthContext); // Get hasRole from AuthContext
  const [currentPage, setCurrentPage] = useState("login"); // Simulate routing
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // State for sidebar visibility

  useEffect(() => {
    window.setCurrentPage = setCurrentPage;
    return () => {
      delete window.setCurrentPage;
    };
  }, []);

  useEffect(() => {
    // If user is logged in, navigate to dashboard
    if (user) {
      setCurrentPage("dashboard");
    } else {
      setCurrentPage("login");
    }
  }, [user]);

  const handleLoginSuccess = () => {
    setCurrentPage("dashboard");
  };

  const handleRegisterSuccess = () => {
    setCurrentPage("login"); // After registration, go to login page
  };

  // Tailwind CSS CDN import
  useEffect(() => {
    const link = document.createElement("link");
    link.href =
      "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);

    const script = document.createElement("script");
    script.src = "https://cdn.tailwindcss.com";
    document.head.appendChild(script);

    // Set Inter font as default
    document.documentElement.style.fontFamily = "'Inter', sans-serif";

    return () => {
      document.head.removeChild(link);
      document.head.removeChild(script);
    };
  }, []);

  const renderContent = () => {
    switch (currentPage) {
      case "login":
        return (
          <LoginPage
            onLoginSuccess={handleLoginSuccess}
            onGoToRegister={() => setCurrentPage("register")}
          />
        );
      case "register":
        return (
          <RegisterPage
            onRegisterSuccess={handleRegisterSuccess}
            onGoToLogin={() => setCurrentPage("login")}
          />
        );
      case "dashboard":
        return <DashboardPage />;
      case "user-management":
        return <UserManagementPage />;
      default:
        return (
          <LoginPage
            onLoginSuccess={handleLoginSuccess}
            onGoToRegister={() => setCurrentPage("register")}
          />
        );
    }
  };

  return (
    <div className="flex min-h-screen w-full bg-gray-100">
      {" "}
      {user && ( // Only show sidebar if user is logged in
        <>
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-md bg-indigo-600 text-white shadow-lg"
            aria-label="Toggle sidebar"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>

          {/* Sidebar */}
          <div
            className={`fixed inset-y-0 left-0 z-40 w-64 bg-gray-800 text-white transform ${
              isSidebarOpen ? "translate-x-0" : "-translate-x-full"
            } lg:translate-x-0 transition-transform duration-300 ease-in-out flex flex-col`}
          >
            <div className="p-6 text-2xl font-bold text-indigo-300 border-b border-gray-700">
              TodoApp
            </div>
            <nav className="flex-1 px-2 py-4 space-y-2">
              <button
                onClick={() => {
                  setCurrentPage("dashboard");
                  setIsSidebarOpen(false);
                }}
                className={`w-full text-left px-4 py-2 rounded-md transition duration-200 ${
                  currentPage === "dashboard"
                    ? "bg-indigo-700 text-white"
                    : "hover:bg-gray-700 text-gray-300"
                }`}
              >
                Tareas
              </button>
              {hasRole(["administrador"]) && ( // Only show Users link to Admin
                <button
                  onClick={() => {
                    setCurrentPage("user-management");
                    setIsSidebarOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2 rounded-md transition duration-200 ${
                    currentPage === "user-management"
                      ? "bg-indigo-700 text-white"
                      : "hover:bg-gray-700 text-gray-300"
                  }`}
                >
                  Usuarios
                </button>
              )}
            </nav>
            <div className="p-4 border-t border-gray-700 text-sm text-gray-400">
              <p>Conectado como:</p>
              <p className="font-semibold">{user?.email}</p>
              <p className="text-xs">
                Roles: {user?.roles?.join(", ") || "N/A"}
              </p>
            </div>
          </div>
        </>
      )}
      {/* Main Content Area */}
      <div
        className={`flex-1 flex flex-col ${
          user ? "lg:ml-64" : ""
        } transition-all duration-300 ease-in-out w-full`}
      >
        {" "}
        {/* Added w-full */}
        {renderContent()}
      </div>
    </div>
  );
};

// Wrap the App with all providers
const WrappedApp = () => (
  <AuthProvider>
    <UserManagementProvider>
      {" "}
      {/* UserManagementProvider needs AuthContext */}
      <TaskProvider>
        {" "}
        {/* TaskProvider needs AuthContext */}
        <App />
      </TaskProvider>
    </UserManagementProvider>
  </AuthProvider>
);

export default WrappedApp;
