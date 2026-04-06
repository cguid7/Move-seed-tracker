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

// Slack setup
const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const SLACK_USER_ID = process.env.SLACK_USER_ID;

// Send Slack notification
async function sendSlackNotification(request) {
  if (!SLACK_BOT_TOKEN || !SLACK_USER_ID) {
    console.log('Slack not configured, skipping notification');
    return;
  }

  try {
    // Format products for message
    let productsText = '';
    if (request.products.insoles && request.products.insoles.length > 0) {
      productsText += '\n*Insoles:*\n';
      request.products.insoles.forEach(p => {
        productsText += `  • ${p.type} - ${p.size} (Qty: ${p.qty})\n`;
      });
    }
    if (request.products.shirts && request.products.shirts.length > 0) {
      productsText += '\n*T-Shirts:*\n';
      request.products.shirts.forEach(p => {
        productsText += `  • ${p.type} - Size ${p.size} (Qty: ${p.qty})\n`;
      });
    }
    if (request.products.socks && request.products.socks.length > 0) {
      productsText += '\n*Socks:*\n';
      request.products.socks.forEach(p => {
        productsText += `  • ${p.type} - ${p.size} (Qty: ${p.qty})\n`;
      });
    }

    const address = `${request.address.street1}${request.address.street2 ? ', ' + request.address.street2 : ''}, ${request.address.city}, ${request.address.state} ${request.address.zip}, ${request.address.country}`;

    const message = {
      channel: SLACK_USER_ID,
      text: `🌱 New Seed Request ${request.urgent ? '🚨 URGENT' : ''}`,
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: `🌱 New Seed Request ${request.urgent ? '🚨 URGENT' : ''}`,
            emoji: true
          }
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: `*Submitted By:*\n${request.submitter}`
            },
            {
              type: "mrkdwn",
              text: `*Request ID:*\n#${request.id}`
            },
            {
              type: "mrkdwn",
              text: `*Recipient:*\n${request.recipient.name}`
            },
            {
              type: "mrkdwn",
              text: `*Email:*\n${request.recipient.email}`
            }
          ]
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Shipping Address:*\n${address}`
          }
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Products Requested:*${productsText}`
          }
        }
      ]
    };

    if (request.notes) {
      message.blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Notes:*\n${request.notes}`
        }
      });
    }

    message.blocks.push({
      type: "actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "View Dashboard",
            emoji: true
          },
          url: `${process.env.APP_URL || 'https://move-seed-tracker.onrender.com'}`,
          action_id: "view_dashboard"
        }
      ]
    });

    const response = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SLACK_BOT_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(message)
    });

    const data = await response.json();
    if (!data.ok) {
      console.error('Slack API error:', data.error);
    }
  } catch (error) {
    console.error('Error sending Slack notification:', error);
  }
}

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
    
    // Send Slack notification
    await sendSlackNotification(data[0]);
    
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
