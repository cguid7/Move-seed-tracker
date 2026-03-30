const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Supabase setup
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Get all requests
app.get('/api/requests', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('seed_requests')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error fetching requests:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create new request
app.post('/api/requests', async (req, res) => {
  try {
    const requestData = {
      ...req.body,
      created_at: new Date().toISOString(),
      status: 'pending'
    };
    
    const { data, error } = await supabase
      .from('seed_requests')
      .insert([requestData])
      .select();
    
    if (error) throw error;
    res.status(201).json(data[0]);
  } catch (error) {
    console.error('Error creating request:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update request
app.patch('/api/requests/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('seed_requests')
      .update(req.body)
      .eq('id', id)
      .select();
    
    if (error) throw error;
    res.json(data[0]);
  } catch (error) {
    console.error('Error updating request:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete request
app.delete('/api/requests/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase
      .from('seed_requests')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting request:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
