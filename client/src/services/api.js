import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5003';

const api = {
  // Get analytics data for dashboard
  getAnalytics: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/analytics`);
      if (!response.ok) {
        throw new Error('Failed to fetch analytics');
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching analytics:', error);
      throw error;
    }
  },

  // Search posts
  searchPosts: async (query, page = 1, limit = 20) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/posts/search`, {
        params: { q: query, page, limit }
      });
      return response.data;
    } catch (error) {
      console.error('Error searching posts:', error);
      throw error;
    }
  },

  // Get posts by source
  getPostsBySource: async (source, page = 1, limit = 20) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/posts/source/${source}`, {
        params: { page, limit }
      });
      return response.data;
    } catch (error) {
      console.error(`Error fetching ${source} posts:`, error);
      throw error;
    }
  },

  // Get influencers data
  getInfluencers: async (platform = 'All', topic = 'All', page = 1, limit = 10, startDate, endDate) => {
    let query = '';
    const params = [];
    if (platform && platform !== 'All') params.push(`platform=${encodeURIComponent(platform)}`);
    if (topic && topic !== 'All') params.push(`topic=${encodeURIComponent(topic)}`);
    if (page) params.push(`page=${page}`);
    if (limit) params.push(`limit=${limit}`);
    if (startDate) params.push(`startDate=${encodeURIComponent(startDate)}`);
    if (endDate) params.push(`endDate=${encodeURIComponent(endDate)}`);
    if (params.length) query = '?' + params.join('&');
    const response = await fetch(`${API_BASE_URL}/api/influencers${query}`);
    if (!response.ok) throw new Error('Failed to fetch influencers');
    return response.json();
  },

  // Get media types breakdown
  getMediaTypes: async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/influencers/media-types`);
      return response.data;
    } catch (error) {
      throw new Error('Failed to fetch media types data');
    }
  },

  // Get posts with highest engagement
  getMostEngagementPosts: async (page = 1, platform = 'all', startDate, endDate) => {
    try {
      const params = { page, platform };
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      const response = await axios.get(`${API_BASE_URL}/api/posts/engagement`, {
        params
      });
      return response.data;
    } catch (error) {
      throw new Error('Failed to fetch posts with highest engagement');
    }
  },

  // Get source distribution analytics
  getSourceDistribution: async (startDate, endDate) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/source-distribution`, {
        params: { startDate, endDate }
      });
      return response.data;
    } catch (error) {
      throw new Error('Failed to fetch source distribution data');
    }
  },

  // User profile operations
  getUserProfile: async (userId) => {
    try {
      console.log(`Fetching profile for user ID: ${userId}`);
      const response = await axios.get(`${API_BASE_URL}/api/users/${userId}`);
      console.log('User profile API response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      console.error('Error details:', error.response?.data);
      throw error;
    }
  },

  updateUserProfile: async (userId, profileData) => {
    try {
      console.log(`Updating profile for user ID: ${userId} with data:`, profileData);
      
      // Add a unique request identifier for tracking this particular request
      const requestId = `profile-update-${Date.now()}`;
      console.log(`API Request [${requestId}]: PATCH ${API_BASE_URL}/api/users/${userId}/profile`);
      
      // Check if token exists
      const token = localStorage.getItem('token');
      if (!token) {
        console.error(`API Request [${requestId}]: No token found in localStorage`);
        throw new Error('Authentication token not found');
      }
      
      // Set authorization header manually for this request
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      };
      console.log(`API Request [${requestId}]: Using headers:`, {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token.substring(0, 10)}...`
      });
      
      const response = await axios.patch(
        `${API_BASE_URL}/api/users/${userId}/profile`, 
        profileData,
        { headers }
      );
      
      console.log(`API Response [${requestId}]:`, response.data);
      return response.data;
    } catch (error) {
      console.error('Error updating user profile:', error);
      
      // Enhanced error logging
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        console.error('Error response status:', error.response.status);
        console.error('Error response data:', error.response.data);
        console.error('Error response headers:', error.response.headers);
      } else if (error.request) {
        // The request was made but no response was received
        console.error('Error request:', error.request);
      } else {
        // Something happened in setting up the request that triggered an Error
        console.error('Error message:', error.message);
      }
      
      throw error;
    }
  },

  updatePassword: async (userId, passwordData) => {
    try {
      console.log(`Updating password for user ID: ${userId}`);
      const response = await axios.patch(`${API_BASE_URL}/api/users/${userId}/password`, passwordData);
      console.log('Update password API response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error updating password:', error);
      console.error('Error details:', error.response?.data);
      throw error;
    }
  }
};

export default api; 