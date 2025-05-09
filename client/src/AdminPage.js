import React, { useState, useEffect } from 'react';
import { Shield, Trash2, User, Search, AlertCircle, ChevronDown, UserPlus, UserMinus } from 'lucide-react';
import axios from 'axios';
import './AdminPage.css';
import { useSession } from './contexts/SessionContext';

const AdminPage = ({ navigateTo }) => {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [changingRole, setChangingRole] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const { user: currentUser, updateActivity } = useSession();
  
  // Fetch users and roles on component mount
  useEffect(() => {
    console.log('Current user in AdminPage:', currentUser);
    if (currentUser?.permissions) {
      console.log('User permissions:', currentUser.permissions);
    }
    fetchUsers();
    fetchRoles();
  }, []);
  
  const fetchUsers = async () => {
    try {
      setLoading(true);
      updateActivity();
      
      const response = await axios.get('http://localhost:5003/api/users');
      setUsers(response.data);
      setError(null);
    } catch (err) {
      console.error('Error fetching users:', err);
      setError('Failed to load users. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const fetchRoles = async () => {
    try {
      updateActivity();
      
      const response = await axios.get('http://localhost:5003/api/roles');
      // Filter out any "Admin" role since Admin is a status, not a role
      const filteredRoles = response.data.filter(role => role.name.toLowerCase() !== 'admin');
      setRoles(filteredRoles);
    } catch (err) {
      console.error('Error fetching roles:', err);
      // Don't set error state here to avoid overriding user fetch errors
    }
  };
  
  const handlePromoteUser = async (userId) => {
    try {
      updateActivity();
      const targetUser = users.find(u => u._id === userId);
      
      // Confirm before changing admin status
      const isConfirmed = window.confirm(
        targetUser.isAdmin 
          ? `Remove admin privileges from ${targetUser.name}?` 
          : `Promote ${targetUser.name} to admin?`
      );
      
      if (!isConfirmed) return;
      
      const response = await axios.patch(`http://localhost:5003/api/users/${userId}/role`, {
        isAdmin: !targetUser.isAdmin
      });
      
      if (response.data && response.data.user) {
        setUsers(users.map(user => 
          user._id === userId ? { ...user, isAdmin: response.data.user.isAdmin } : user
        ));
        showSuccess(`User ${targetUser.isAdmin ? 'demoted' : 'promoted'} successfully`);
      }
    } catch (err) {
      console.error('Error updating user role:', err);
      setError('Failed to update user role. Please try again.');
    }
  };

  const handleChangeRole = async (userId, roleId) => {
    try {
      updateActivity();
      const targetUser = users.find(u => u._id === userId);
      
      const response = await axios.patch(`http://localhost:5003/api/users/${userId}/role`, {
        roleId: roleId
      });
      
      if (response.data && response.data.user) {
        setUsers(users.map(user => 
          user._id === userId ? { 
            ...user, 
            role: response.data.user.role, 
            roleId: response.data.user.roleId 
          } : user
        ));
        showSuccess(`Role updated successfully for ${targetUser.name}`);
      }
      
      setChangingRole(null);
    } catch (err) {
      console.error('Error changing user role:', err);
      setError('Failed to change user role. Please try again.');
    }
  };
  
  const showDeleteConfirmation = (userId) => {
    setConfirmDelete(userId);
  };
  
  const cancelDelete = () => {
    setConfirmDelete(null);
  };
  
  const handleDeleteUser = async (userId) => {
    try {
      updateActivity();
      
      await axios.delete(`http://localhost:5003/api/users/${userId}`);
      setUsers(users.filter(user => user._id !== userId));
      setConfirmDelete(null);
      showSuccess('User deleted successfully');
    } catch (err) {
      console.error('Error deleting user:', err);
      setError('Failed to delete user. Please try again.');
    }
  };

  const showSuccess = (message) => {
    setSuccessMessage(message);
    setTimeout(() => {
      setSuccessMessage(null);
    }, 3000);
  };

  const handleRoleManagementClick = () => {
    navigateTo('roleManagement');
  };
  
  // Find role name by ID
  const getRoleName = (roleId) => {
    const role = roles.find(r => r._id === roleId);
    return role ? role.name : 'Unknown';
  };
  
  // Filter users based on search term
  const filteredUsers = users.filter(user => 
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.isAdmin && 'admin'.includes(searchTerm.toLowerCase())) // Also filter by admin status
  );
  
  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };
  
  return (
    <div className="admin-page">
      <div className="admin-content">
        <div className="admin-header">
          <div className="admin-title">
            <h1>Admin Dashboard</h1>
            <p>Manage users and system settings</p>
          </div>
          <button 
            className="role-management-button" 
            onClick={handleRoleManagementClick}
          >
            <Shield size={16} />
            Manage Roles
          </button>
        </div>
        
        <div className="help-text">
          <p><strong>Note:</strong> Admin status is managed separately and is not a role. Users with admin status have unrestricted access regardless of their assigned role.</p>
        </div>
        
        <div className="admin-controls">
          <div className="search-bar">
            <Search size={20} className="search-icon" />
            <input 
              type="text" 
              placeholder="Search users by name, email or role" 
              value={searchTerm}
              onChange={handleSearchChange}
            />
          </div>
        </div>
        
        {successMessage && (
          <div className="success-message">
            <AlertCircle size={20} />
            <span>{successMessage}</span>
          </div>
        )}
        
        {error && (
          <div className="error-message">
            <AlertCircle size={20} />
            <span>{error}</span>
          </div>
        )}
        
        {loading ? (
          <div className="loading">
            <div className="spinner"></div>
            <p>Loading users...</p>
          </div>
        ) : (
          <div className="users-table-container">
            <table className="users-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Last Login</th>
                  <th>Last Active</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="no-users">
                      {searchTerm ? 'No users match your search' : 'No users found'}
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map(user => (
                    <tr key={user._id} className={user._id === currentUser?.id ? 'current-user' : ''}>
                      <td>{user.name}</td>
                      <td>{user.email}</td>
                      <td>
                        {changingRole === user._id ? (
                          <div className="role-dropdown">
                            <select 
                              defaultValue={user.roleId || ""}
                              onChange={(e) => handleChangeRole(user._id, e.target.value)}
                              className="role-select"
                            >
                              <option value="">Select a role</option>
                              {roles.map(role => (
                                <option key={role._id} value={role._id}>
                                  {role.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        ) : (
                          <div className="role-display" onClick={() => setChangingRole(user._id)}>
                            <span className="role-badge">
                              {user.roleId ? getRoleName(user.roleId) : user.role}
                            </span>
                            <ChevronDown size={14} className="dropdown-icon" />
                          </div>
                        )}
                      </td>
                      <td>
                        <span className={`admin-status ${user.isAdmin ? 'is-admin' : 'not-admin'}`}>
                          {user.isAdmin ? 'Admin' : '-'}
                        </span>
                      </td>
                      <td>{user.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'Never'}</td>
                      <td>{user.lastActive ? new Date(user.lastActive).toLocaleString() : 'Never'}</td>
                      <td>
                        <div className="action-buttons">
                          <button 
                            className={`promote-button ${user.isAdmin ? 'demote' : 'promote'}`}
                            onClick={() => handlePromoteUser(user._id)}
                            disabled={user._id === currentUser?.id}
                            title={user.isAdmin ? "Remove admin privileges" : "Promote to admin"}
                          >
                            {user.isAdmin ? <UserMinus size={16} /> : <UserPlus size={16} />}
                          </button>
                          <button 
                            className="delete-button"
                            onClick={() => showDeleteConfirmation(user._id)}
                            disabled={user._id === currentUser?.id}
                            title="Delete user"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
      
      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div className="delete-modal-overlay">
          <div className="delete-modal">
            <h3>Confirm Delete</h3>
            <p>Are you sure you want to delete this user? This action cannot be undone.</p>
            <div className="delete-modal-buttons">
              <button className="cancel-button" onClick={cancelDelete}>Cancel</button>
              <button className="confirm-button" onClick={() => handleDeleteUser(confirmDelete)}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPage; 