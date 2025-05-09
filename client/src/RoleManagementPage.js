import React, { useState, useEffect } from 'react';
import { Shield, Trash2, Plus, Edit, Save, X, AlertCircle, Check } from 'lucide-react';
import axios from 'axios';
import { useSession } from './contexts/SessionContext';
import './RoleManagementPage.css';

const permissionGroups = [
  {
    name: 'Pages',
    permissions: [
      { id: 'advancedSearch', name: 'Advanced Search' },
      { id: 'dashboard', name: 'Dashboard' },
      { id: 'influencers', name: 'Top Influencers' },
      { id: 'themes', name: 'Top Themes' },
      { id: 'engagement', name: 'Most Engagement' },
      { id: 'geographical', name: 'Geographical Distribution' },
      { id: 'source', name: 'Source Distribution' },
      { id: 'sentiment', name: 'Sentiment Analysis' },
      { id: 'seasonal', name: 'Seasonal Analysis' },
      { id: 'help', name: 'Help' },
      { id: 'settings', name: 'Settings' }
    ]
  }
];

const RoleManagementPage = () => {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingRole, setEditingRole] = useState(null);
  const [newRoleName, setNewRoleName] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState([]);
  const [showAddRole, setShowAddRole] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const { updateActivity } = useSession();

  // Fetch roles on component mount
  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    try {
      setLoading(true);
      updateActivity();
      const response = await axios.get('http://localhost:5003/api/roles');
      
      // Filter out any "Admin" role - admin is now a status, not a role
      const filteredRoles = response.data.filter(role => role.name !== 'Admin');
      setRoles(filteredRoles);
      
      setError(null);
    } catch (err) {
      console.error('Error fetching roles:', err);
      setError('Failed to load roles. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRole = async () => {
    if (!newRoleName.trim()) {
      setError('Role name cannot be empty');
      return;
    }

    // Prevent creating a role named "Admin"
    if (newRoleName.trim().toLowerCase() === 'admin') {
      setError('"Admin" is reserved for admin status and cannot be used as a role name');
      return;
    }

    try {
      updateActivity();
      const response = await axios.post('http://localhost:5003/api/roles', {
        name: newRoleName,
        permissions: selectedPermissions
      });
      
      setRoles([...roles, response.data]);
      setNewRoleName('');
      setSelectedPermissions([]);
      setShowAddRole(false);
      showSuccess('Role created successfully');
    } catch (err) {
      console.error('Error creating role:', err);
      setError(err.response?.data?.message || 'Failed to create role');
    }
  };

  const handleUpdateRole = async () => {
    if (!editingRole || !editingRole.name.trim()) {
      setError('Role name cannot be empty');
      return;
    }

    // Prevent renaming a role to "Admin"
    if (editingRole.name.trim().toLowerCase() === 'admin') {
      setError('"Admin" is reserved for admin status and cannot be used as a role name');
      return;
    }

    try {
      updateActivity();
      const response = await axios.put(`http://localhost:5003/api/roles/${editingRole._id}`, {
        name: editingRole.name,
        permissions: editingRole.permissions
      });
      
      setRoles(roles.map(role => 
        role._id === editingRole._id ? response.data : role
      ));
      setEditingRole(null);
      showSuccess('Role updated successfully');
    } catch (err) {
      console.error('Error updating role:', err);
      setError(err.response?.data?.message || 'Failed to update role');
    }
  };

  const handleDeleteRole = async (roleId) => {
    try {
      updateActivity();
      await axios.delete(`http://localhost:5003/api/roles/${roleId}`);
      
      setRoles(roles.filter(role => role._id !== roleId));
      setConfirmDelete(null);
      showSuccess('Role deleted successfully');
    } catch (err) {
      console.error('Error deleting role:', err);
      setError(err.response?.data?.message || 'Failed to delete role');
    }
  };

  const handleEditRole = (role) => {
    setEditingRole({...role});
  };

  const handlePermissionChange = (permissionId, isChecked) => {
    if (editingRole) {
      if (isChecked) {
        setEditingRole({
          ...editingRole,
          permissions: [...editingRole.permissions, permissionId]
        });
      } else {
        setEditingRole({
          ...editingRole,
          permissions: editingRole.permissions.filter(id => id !== permissionId)
        });
      }
    } else {
      if (isChecked) {
        setSelectedPermissions([...selectedPermissions, permissionId]);
      } else {
        setSelectedPermissions(selectedPermissions.filter(id => id !== permissionId));
      }
    }
  };

  const cancelEdit = () => {
    setEditingRole(null);
  };

  const showDeleteConfirmation = (roleId) => {
    setConfirmDelete(roleId);
  };

  const cancelDelete = () => {
    setConfirmDelete(null);
  };

  const showSuccess = (message) => {
    setSuccessMessage(message);
    setTimeout(() => {
      setSuccessMessage(null);
    }, 3000);
  };

  if (loading) {
    return (
      <div className="role-management-page">
        <div className="role-management-content">
          <div className="loading">
            <div className="spinner"></div>
            <p>Loading roles...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="role-management-page">
      <div className="role-management-content">
        <div className="role-management-header">
          <h1>Role Management</h1>
          <p>Create and manage user roles and permissions</p>
          <div className="help-text">
            <p><strong>Note:</strong> Admin status is managed separately and is not a role. Users with admin status have unrestricted access regardless of their assigned role.</p>
          </div>
          <button 
            className="add-role-button" 
            onClick={() => setShowAddRole(!showAddRole)}
          >
            {showAddRole ? <X size={16} /> : <Plus size={16} />}
            {showAddRole ? 'Cancel' : 'Add New Role'}
          </button>
        </div>

        {successMessage && (
          <div className="success-message">
            <Check size={20} />
            <span>{successMessage}</span>
          </div>
        )}
        
        {error && (
          <div className="error-message">
            <AlertCircle size={20} />
            <span>{error}</span>
          </div>
        )}

        {showAddRole && (
          <div className="role-form">
            <h2>Create New Role</h2>
            <div className="role-form-row">
              <label>Role Name:</label>
              <input 
                type="text" 
                value={newRoleName} 
                onChange={(e) => setNewRoleName(e.target.value)}
                placeholder="Enter role name (cannot be 'Admin')"
              />
            </div>
            <div className="permissions-section">
              <h3>Permissions</h3>
              {permissionGroups.map((group, index) => (
                <div key={index} className="permission-group">
                  <h4>{group.name}</h4>
                  <div className="permission-checkboxes">
                    {group.permissions.map((permission, idx) => (
                      <div key={idx} className="permission-checkbox">
                        <input 
                          type="checkbox"
                          id={`new-${permission.id}`}
                          checked={selectedPermissions.includes(permission.id)}
                          onChange={(e) => handlePermissionChange(permission.id, e.target.checked)}
                        />
                        <label htmlFor={`new-${permission.id}`}>{permission.name}</label>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="role-form-actions">
              <button 
                className="cancel-button" 
                onClick={() => setShowAddRole(false)}
              >
                Cancel
              </button>
              <button 
                className="create-button" 
                onClick={handleCreateRole}
              >
                Create Role
              </button>
            </div>
          </div>
        )}

        <div className="roles-list">
          {roles.length === 0 ? (
            <div className="no-roles">
              <p>No roles found. Create a new role to get started.</p>
            </div>
          ) : (
            roles.map((role) => (
              <div key={role._id} className={`role-card ${editingRole?._id === role._id ? 'editing' : ''}`}>
                {editingRole?._id === role._id ? (
                  <>
                    <div className="role-edit-header">
                      <h3>Edit Role</h3>
                      <input 
                        type="text" 
                        value={editingRole.name} 
                        onChange={(e) => setEditingRole({...editingRole, name: e.target.value})}
                        className="role-name-input"
                        placeholder="Role name (cannot be 'Admin')"
                      />
                    </div>
                    <div className="permissions-section">
                      <h4>Permissions</h4>
                      {permissionGroups.map((group, index) => (
                        <div key={index} className="permission-group">
                          <h5>{group.name}</h5>
                          <div className="permission-checkboxes">
                            {group.permissions.map((permission, idx) => (
                              <div key={idx} className="permission-checkbox">
                                <input 
                                  type="checkbox"
                                  id={`edit-${permission.id}-${role._id}`}
                                  checked={editingRole.permissions.includes(permission.id)}
                                  onChange={(e) => handlePermissionChange(permission.id, e.target.checked)}
                                />
                                <label htmlFor={`edit-${permission.id}-${role._id}`}>{permission.name}</label>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="role-card-actions">
                      <button 
                        className="cancel-edit-button" 
                        onClick={cancelEdit}
                      >
                        <X size={16} />
                        Cancel
                      </button>
                      <button 
                        className="save-button" 
                        onClick={handleUpdateRole}
                      >
                        <Save size={16} />
                        Save Changes
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="role-card-header">
                      <div className="role-info">
                        <Shield size={20} className="role-icon" />
                        <h3 className="role-name">{role.name}</h3>
                      </div>
                      <div className="role-card-actions">
                        <button 
                          className="edit-button" 
                          onClick={() => handleEditRole(role)}
                          title="Edit role"
                        >
                          <Edit size={16} />
                        </button>
                        <button 
                          className="delete-button" 
                          onClick={() => showDeleteConfirmation(role._id)}
                          title="Delete role"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                    <div className="role-permissions">
                      <h4>Permissions:</h4>
                      <div className="permissions-list">
                        {role.permissions.length === 0 ? (
                          <p className="no-permissions">No permissions assigned</p>
                        ) : (
                          <ul>
                            {permissionGroups.map(group => 
                              group.permissions
                                .filter(permission => role.permissions.includes(permission.id))
                                .map((permission, idx) => (
                                  <li key={idx} className="permission-item">
                                    <Check size={14} className="permission-check" />
                                    {permission.name}
                                  </li>
                                ))
                            )}
                          </ul>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div className="delete-modal-overlay">
          <div className="delete-modal">
            <h3>Confirm Delete</h3>
            <p>Are you sure you want to delete this role? This action cannot be undone and may affect users currently assigned to this role.</p>
            <div className="delete-modal-buttons">
              <button className="cancel-button" onClick={cancelDelete}>Cancel</button>
              <button className="confirm-button" onClick={() => handleDeleteRole(confirmDelete)}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoleManagementPage; 