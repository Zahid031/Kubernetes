import React, { useState, useEffect } from 'react';

const API_USERS = 'http://localhost:8000/api/users';
const API_TASKS = 'http://localhost:8001/api/tasks';

function App() {
  const [users, setUsers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // User form state
  const [userForm, setUserForm] = useState({
    name: '',
    email: ''
  });

  // Task form state
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    user_id: ''
  });

  // Fetch users
  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_USERS}/`);
      if (!response.ok) throw new Error('Failed to fetch users');
      const data = await response.json();
      setUsers(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch all tasks
  const fetchAllTasks = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_TASKS}/`);
      if (!response.ok) throw new Error('Failed to fetch tasks');
      const data = await response.json();
      setTasks(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch tasks by user
  const fetchUserTasks = async (userId) => {
    if (!userId) {
      fetchAllTasks();
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${API_TASKS}/user/${userId}`);
      if (!response.ok) throw new Error('Failed to fetch user tasks');
      const data = await response.json();
      setTasks(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Create user
  const createUser = async (e) => {
    e.preventDefault();
    if (!userForm.name || !userForm.email) return;
    
    try {
      setLoading(true);
      const response = await fetch(`${API_USERS}/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userForm)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(Object.values(errorData).flat().join(', '));
      }

      setUserForm({ name: '', email: '' });
      fetchUsers();
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Create task
  const createTask = async (e) => {
    e.preventDefault();
    if (!taskForm.title || !taskForm.user_id) return;
    
    try {
      setLoading(true);
      const response = await fetch(`${API_TASKS}/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...taskForm,
          user_id: parseInt(taskForm.user_id)
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create task');
      }

      setTaskForm({ title: '', description: '', user_id: '' });
      fetchUserTasks(selectedUserId);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Toggle task completion
  const toggleTask = async (taskId, completed) => {
    try {
      const response = await fetch(`${API_TASKS}/${taskId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ completed: !completed })
      });

      if (!response.ok) throw new Error('Failed to update task');
      
      fetchUserTasks(selectedUserId);
    } catch (err) {
      setError(err.message);
    }
  };

  // Delete task
  const deleteTask = async (taskId) => {
    if (!confirm('Are you sure you want to delete this task?')) return;

    try {
      const response = await fetch(`${API_TASKS}/${taskId}`, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Failed to delete task');
      
      fetchUserTasks(selectedUserId);
    } catch (err) {
      setError(err.message);
    }
  };

  // Delete user
  const deleteUser = async (userId) => {
    if (!confirm('Are you sure you want to delete this user?')) return;

    try {
      const response = await fetch(`${API_USERS}/${userId}/`, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Failed to delete user');
      
      fetchUsers();
      if (selectedUserId === userId.toString()) {
        setSelectedUserId('');
        fetchAllTasks();
      }
    } catch (err) {
      setError(err.message);
    }
  };

  // Load initial data
  useEffect(() => {
    fetchUsers();
    fetchAllTasks();
  }, []);

  // Handle user filter change
  const handleUserFilterChange = (userId) => {
    setSelectedUserId(userId);
    fetchUserTasks(userId);
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>Todo Microservices Frontend</h1>
      
      {error && (
        <div style={{ 
          color: 'red', 
          padding: '10px', 
          border: '1px solid red', 
          borderRadius: '4px',
          marginBottom: '20px',
          backgroundColor: '#ffe6e6'
        }}>
          Error: {error}
        </div>
      )}

      {loading && <div>Loading...</div>}

      {/* Create User Section */}
      <div style={{ marginBottom: '30px', padding: '20px', border: '1px solid #ccc' }}>
        <h2>Create User</h2>
        <div>
          <div style={{ marginBottom: '10px' }}>
            <label>Name: </label>
            <input
              type="text"
              value={userForm.name}
              onChange={(e) => setUserForm({...userForm, name: e.target.value})}
              style={{ marginLeft: '10px', padding: '5px' }}
            />
          </div>
          <div style={{ marginBottom: '10px' }}>
            <label>Email: </label>
            <input
              type="email"
              value={userForm.email}
              onChange={(e) => setUserForm({...userForm, email: e.target.value})}
              style={{ marginLeft: '10px', padding: '5px' }}
            />
          </div>
          <button 
            onClick={(e) => createUser(e)} 
            disabled={loading || !userForm.name || !userForm.email} 
            style={{ padding: '5px 15px' }}
          >
            Create User
          </button>
        </div>
      </div>

      {/* Users List */}
      <div style={{ marginBottom: '30px', padding: '20px', border: '1px solid #ccc' }}>
        <h2>Users</h2>
        {users.length === 0 ? (
          <p>No users found</p>
        ) : (
          <div>
            {users.map(user => (
              <div key={user.id} style={{ 
                padding: '10px', 
                margin: '5px 0', 
                border: '1px solid #ddd',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <strong>{user.name}</strong> - {user.email}
                  <br />
                  <small>Created: {new Date(user.created_at).toLocaleDateString()}</small>
                </div>
                <button 
                  onClick={() => deleteUser(user.id)}
                  style={{ 
                    backgroundColor: 'red', 
                    color: 'white', 
                    border: 'none', 
                    padding: '5px 10px',
                    cursor: 'pointer'
                  }}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Task Section */}
      <div style={{ marginBottom: '30px', padding: '20px', border: '1px solid #ccc' }}>
        <h2>Create Task</h2>
        <div>
          <div style={{ marginBottom: '10px' }}>
            <label>Title: </label>
            <input
              type="text"
              value={taskForm.title}
              onChange={(e) => setTaskForm({...taskForm, title: e.target.value})}
              style={{ marginLeft: '10px', padding: '5px', width: '200px' }}
            />
          </div>
          <div style={{ marginBottom: '10px' }}>
            <label>Description: </label>
            <textarea
              value={taskForm.description}
              onChange={(e) => setTaskForm({...taskForm, description: e.target.value})}
              style={{ marginLeft: '10px', padding: '5px', width: '200px' }}
            />
          </div>
          <div style={{ marginBottom: '10px' }}>
            <label>User: </label>
            <select
              value={taskForm.user_id}
              onChange={(e) => setTaskForm({...taskForm, user_id: e.target.value})}
              style={{ marginLeft: '10px', padding: '5px' }}
            >
              <option value="">Select User</option>
              {users.map(user => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </div>
          <button 
            onClick={(e) => createTask(e)} 
            disabled={loading || !taskForm.title || !taskForm.user_id} 
            style={{ padding: '5px 15px' }}
          >
            Create Task
          </button>
        </div>
      </div>

      {/* Task Filter */}
      <div style={{ marginBottom: '20px' }}>
        <label>Filter by User: </label>
        <select
          value={selectedUserId}
          onChange={(e) => handleUserFilterChange(e.target.value)}
          style={{ marginLeft: '10px', padding: '5px' }}
        >
          <option value="">All Users</option>
          {users.map(user => (
            <option key={user.id} value={user.id}>
              {user.name}
            </option>
          ))}
        </select>
      </div>

      {/* Tasks List */}
      <div style={{ padding: '20px', border: '1px solid #ccc' }}>
        <h2>Tasks {selectedUserId && `for ${users.find(u => u.id.toString() === selectedUserId)?.name}`}</h2>
        {tasks.length === 0 ? (
          <p>No tasks found</p>
        ) : (
          <div>
            {tasks.map(task => {
              const user = users.find(u => u.id === task.user_id);
              return (
                <div key={task.id} style={{ 
                  padding: '15px', 
                  margin: '10px 0', 
                  border: '1px solid #ddd',
                  backgroundColor: task.completed ? '#e8f5e8' : '#fff'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ 
                        margin: '0 0 5px 0',
                        textDecoration: task.completed ? 'line-through' : 'none' 
                      }}>
                        {task.title}
                      </h3>
                      {task.description && (
                        <p style={{ margin: '5px 0', color: '#666' }}>
                          {task.description}
                        </p>
                      )}
                      <small style={{ color: '#888' }}>
                        User: {user ? user.name : `ID: ${task.user_id}`} | 
                        Created: {new Date(task.created_at).toLocaleDateString()} |
                        Status: {task.completed ? 'Completed' : 'Pending'}
                      </small>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button
                        onClick={() => toggleTask(task.id, task.completed)}
                        style={{ 
                          backgroundColor: task.completed ? '#orange' : '#green',
                          color: 'white',
                          border: 'none',
                          padding: '5px 10px',
                          cursor: 'pointer'
                        }}
                      >
                        {task.completed ? 'Mark Pending' : 'Mark Complete'}
                      </button>
                      <button
                        onClick={() => deleteTask(task.id)}
                        style={{ 
                          backgroundColor: 'red',
                          color: 'white',
                          border: 'none',
                          padding: '5px 10px',
                          cursor: 'pointer'
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;