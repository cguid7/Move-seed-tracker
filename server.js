const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // For Slack form data
app.use(express.static('public'));

// Supabase setup
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Slack setup
const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const SLACK_USER_ID = process.env.SLACK_USER_ID;

// Product options
const insoleTypes = ['Game Day', 'All Day', 'Game Day Pro', 'Baseline'];
const tshirtTypes = ['Always In Motion', 'Worldwide Athletics', 'No Shortcuts To Greatness'];
const sockTypes = ['Lock Socks', 'Move Socks', 'Quarter Lock Socks'];
const mensSizes = ['4-4.5', '5-5.5', '6-6.5', '7-7.5', '8-8.5', '9-9.5', '10-10.5', '11-11.5', '12-12.5', '13-13.5', '14-14.5', '15', '16', '17'];
const womensSizes = ['5.5-6', '6.5-7', '7.5-8', '8.5-9', '9.5-10', '10.5-11', '11.5-12', '12.5-13', '13.5-14'];
const tshirtSizes = ['S', 'M', 'L', 'XL', 'XXL'];

// Send Slack DM with interactive buttons
async function sendSlackNotification(request) {
  if (!SLACK_BOT_TOKEN || !SLACK_USER_ID) {
    console.log('Slack not configured');
    return;
  }

  try {
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

    const address = `${request.address.street1}${request.address.street2 ? ', ' + request.address.street2 : ''}, ${request.address.city}, ${request.address.state} ${request.address.zip}`;

    const blocks = [
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
          text: `*Products:*${productsText}`
        }
      }
    ];

    if (request.notes) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Notes:*\n${request.notes}`
        }
      });
    }

    // Add action buttons
    blocks.push({
      type: "actions",
      block_id: `request_${request.id}`,
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "Start Processing"
          },
          style: "primary",
          value: `start_${request.id}`,
          action_id: "start_processing"
        }
      ]
    });

    await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SLACK_BOT_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        channel: SLACK_USER_ID,
        text: `New seed request from ${request.submitter}`,
        blocks: blocks
      })
    });
  } catch (error) {
    console.error('Slack notification error:', error);
  }
}

// Handle /seed slash command
app.post('/slack/command', async (req, res) => {
  const { user_id, user_name } = req.body;
  
  // Open modal with submission form
  const modal = {
    trigger_id: req.body.trigger_id,
    view: {
      type: "modal",
      callback_id: "seed_request_submission",
      private_metadata: JSON.stringify({ user_id, user_name }),
      title: {
        type: "plain_text",
        text: "Seed Request"
      },
      submit: {
        type: "plain_text",
        text: "Submit"
      },
      blocks: [
        {
          type: "input",
          block_id: "recipient_name",
          label: {
            type: "plain_text",
            text: "Recipient Name"
          },
          element: {
            type: "plain_text_input",
            action_id: "value"
          }
        },
        {
          type: "input",
          block_id: "recipient_email",
          label: {
            type: "plain_text",
            text: "Recipient Email"
          },
          element: {
            type: "plain_text_input",
            action_id: "value"
          }
        },
        {
          type: "input",
          block_id: "address",
          label: {
            type: "plain_text",
            text: "Shipping Address"
          },
          element: {
            type: "plain_text_input",
            multiline: true,
            action_id: "value",
            placeholder: {
              type: "plain_text",
              text: "Street address\nCity, State ZIP"
            }
          }
        },
        {
          type: "input",
          block_id: "products",
          label: {
            type: "plain_text",
            text: "Products Needed"
          },
          element: {
            type: "plain_text_input",
            multiline: true,
            action_id: "value",
            placeholder: {
              type: "plain_text",
              text: "e.g., Game Day insoles Men's 10 (Qty 2)\nAlways In Motion shirt Size L (Qty 1)"
            }
          }
        },
        {
          type: "input",
          block_id: "notes",
          optional: true,
          label: {
            type: "plain_text",
            text: "Additional Notes"
          },
          element: {
            type: "plain_text_input",
            multiline: true,
            action_id: "value"
          }
        },
        {
          type: "input",
          block_id: "urgent",
          optional: true,
          label: {
            type: "plain_text",
            text: "Is this urgent?"
          },
          element: {
            type: "checkboxes",
            action_id: "value",
            options: [
              {
                text: {
                  type: "plain_text",
                  text: "Yes, this is urgent"
                },
                value: "urgent"
              }
            ]
          }
        }
      ]
    }
  };

  try {
    await fetch('https://slack.com/api/views.open', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SLACK_BOT_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(modal)
    });
    
    res.send('');
  } catch (error) {
    console.error('Error opening modal:', error);
    res.status(500).send('Error opening form');
  }
});

// Handle /seedadmin command - shows dashboard
app.post('/slack/admin', async (req, res) => {
  const { user_id } = req.body;
  
  // Only allow specific user
  if (user_id !== SLACK_USER_ID) {
    res.json({
      response_type: 'ephemeral',
      text: '❌ You do not have permission to access the admin dashboard.'
    });
    return;
  }
  
  try {
    // Fetch all requests
    const { data: requests, error } = await supabase
      .from('seed_requests')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (error) throw error;
    
    const pending = requests.filter(r => r.status === 'pending');
    const processing = requests.filter(r => r.status === 'processing');
    const shipped = requests.filter(r => r.status === 'shipped');
    
    const blocks = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "📊 Seed Request Dashboard",
          emoji: true
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `📦 *Total:* ${requests.length} | ⏳ *Pending:* ${pending.length} | 🔄 *Processing:* ${processing.length} | ✅ *Shipped:* ${shipped.length}`
        }
      },
      {
        type: "divider"
      }
    ];
    
    // Add filter buttons
    blocks.push({
      type: "actions",
      block_id: "filter_actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "🔴 Pending",
            emoji: true
          },
          value: "filter_pending",
          action_id: "filter_pending"
        },
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "🟡 Processing",
            emoji: true
          },
          value: "filter_processing",
          action_id: "filter_processing"
        },
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "🟢 Shipped",
            emoji: true
          },
          value: "filter_shipped",
          action_id: "filter_shipped"
        },
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "All",
            emoji: true
          },
          value: "filter_all",
          action_id: "filter_all"
        }
      ]
    });
    
    blocks.push({
      type: "divider"
    });
    
    // Show pending requests with action buttons
    if (pending.length > 0) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: "*🔴 Pending Requests:*"
        }
      });
      
      pending.slice(0, 10).forEach(req => {
        const date = new Date(req.created_at).toLocaleDateString();
        blocks.push({
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*#${req.id}* - ${req.recipient.name} ${req.urgent ? '🚨' : ''}\nFrom: ${req.submitter} | ${date}`
          },
          accessory: {
            type: "button",
            text: {
              type: "plain_text",
              text: "View Details",
              emoji: true
            },
            value: `view_${req.id}`,
            action_id: "view_request_details"
          }
        });
      });
    }
    
    // Show processing requests
    if (processing.length > 0) {
      blocks.push({
        type: "divider"
      });
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: "*🟡 Processing:*"
        }
      });
      
      processing.slice(0, 5).forEach(req => {
        const date = new Date(req.created_at).toLocaleDateString();
        blocks.push({
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*#${req.id}* - ${req.recipient.name}\n${date}${req.shopify_order_id ? ` | Shopify: ${req.shopify_order_id}` : ''}`
          },
          accessory: {
            type: "button",
            text: {
              type: "plain_text",
              text: "View Details",
              emoji: true
            },
            value: `view_${req.id}`,
            action_id: "view_request_details"
          }
        });
      });
    }
    
    res.json({
      response_type: 'ephemeral',
      blocks: blocks
    });
  } catch (error) {
    console.error('Error fetching dashboard:', error);
    res.json({
      response_type: 'ephemeral',
      text: '❌ Error loading dashboard. Please try again.'
    });
  }
});

// Handle interactive components (button clicks, modal submissions)
app.post('/slack/interactive', async (req, res) => {
  const payload = JSON.parse(req.body.payload);
  
  // Handle modal submission
  if (payload.type === 'view_submission') {
    const values = payload.view.state.values;
    const metadata = JSON.parse(payload.view.private_metadata);
    
    // Parse address
    const addressText = values.address.value.value;
    const addressLines = addressText.split('\n').map(l => l.trim()).filter(l => l);
    
    // Simple parsing - you can make this more sophisticated
    const street1 = addressLines[0] || '';
    const cityStateZip = addressLines[1] || '';
    const [city, stateZip] = cityStateZip.split(',').map(s => s.trim());
    const [state, zip] = (stateZip || '').split(' ').filter(s => s);
    
    const requestData = {
      submitter: metadata.user_name,
      urgent: values.urgent?.value?.selected_options?.length > 0,
      status: 'pending',
      recipient: {
        name: values.recipient_name.value.value,
        email: values.recipient_email.value.value
      },
      address: {
        street1: street1,
        street2: '',
        city: city || '',
        state: state || '',
        zip: zip || '',
        country: 'USA'
      },
      products: {
        insoles: [],
        shirts: [],
        socks: []
      },
      notes: values.notes?.value?.value || '',
      created_at: new Date().toISOString()
    };
    
    // Parse products from text (basic parsing)
    const productsText = values.products.value.value;
    // For now, store as notes - you can enhance parsing later
    requestData.notes = (requestData.notes ? requestData.notes + '\n\n' : '') + 'Products: ' + productsText;
    
    try {
      const { data, error } = await supabase
        .from('seed_requests')
        .insert([requestData])
        .select();
      
      if (error) throw error;
      
      await sendSlackNotification(data[0]);
      
      res.send('');
    } catch (error) {
      console.error('Error creating request:', error);
      res.status(500).json({ error: error.message });
    }
    
    return;
  }
  
  // Handle button clicks
  if (payload.type === 'block_actions') {
    const action = payload.actions[0];
    
    // View request details
    if (action.action_id === 'view_request_details') {
      const requestId = action.value.split('_')[1];
      
      try {
        const { data: request, error } = await supabase
          .from('seed_requests')
          .select('*')
          .eq('id', requestId)
          .single();
        
        if (error) throw error;
        
        // Format products
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
        
        const address = `${request.address.street1}${request.address.street2 ? ', ' + request.address.street2 : ''}\n${request.address.city}, ${request.address.state} ${request.address.zip}`;
        
        const blocks = [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: `Request #${request.id} ${request.urgent ? '🚨 URGENT' : ''}`,
              emoji: true
            }
          },
          {
            type: "section",
            fields: [
              {
                type: "mrkdwn",
                text: `*Status:*\n${request.status === 'pending' ? '⏳ Pending' : request.status === 'processing' ? '🔄 Processing' : '✅ Shipped'}`
              },
              {
                type: "mrkdwn",
                text: `*Submitted:*\n${new Date(request.created_at).toLocaleDateString()}`
              },
              {
                type: "mrkdwn",
                text: `*From:*\n${request.submitter}`
              },
              {
                type: "mrkdwn",
                text: `*Recipient:*\n${request.recipient.name}`
              }
            ]
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*Email:*\n${request.recipient.email}`
            }
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
              text: `*Products:*${productsText}`
            }
          }
        ];
        
        if (request.notes) {
          blocks.push({
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*Notes:*\n${request.notes}`
            }
          });
        }
        
        if (request.shopify_order_id) {
          blocks.push({
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*Shopify Order ID:*\n${request.shopify_order_id}`
            }
          });
        }
        
        if (request.tracking_number) {
          blocks.push({
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*Tracking:*\n${request.courier || 'Unknown'}: ${request.tracking_number}`
            }
          });
        }
        
        // Add action buttons based on status
        const actionElements = [];
        
        if (request.status === 'pending') {
          actionElements.push({
            type: "button",
            text: {
              type: "plain_text",
              text: "Start Processing"
            },
            style: "primary",
            value: `process_${request.id}`,
            action_id: "admin_start_processing"
          });
        }
        
        if (request.status === 'processing') {
          actionElements.push({
            type: "button",
            text: {
              type: "plain_text",
              text: "Mark as Shipped"
            },
            style: "primary",
            value: `ship_${request.id}`,
            action_id: "admin_mark_shipped"
          });
        }
        
        actionElements.push({
          type: "button",
          text: {
            type: "plain_text",
            text: "Delete Request"
          },
          style: "danger",
          value: `delete_${request.id}`,
          action_id: "admin_delete_request",
          confirm: {
            title: {
              type: "plain_text",
              text: "Are you sure?"
            },
            text: {
              type: "plain_text",
              text: "This will permanently delete this request."
            },
            confirm: {
              type: "plain_text",
              text: "Delete"
            },
            deny: {
              type: "plain_text",
              text: "Cancel"
            }
          }
        });
        
        if (actionElements.length > 0) {
          blocks.push({
            type: "actions",
            elements: actionElements
          });
        }
        
        // Send as ephemeral message
        await fetch('https://slack.com/api/chat.postEphemeral', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${SLACK_BOT_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            channel: payload.channel.id,
            user: payload.user.id,
            blocks: blocks
          })
        });
        
        res.send('');
        return;
      } catch (error) {
        console.error('Error fetching request details:', error);
        res.send('');
        return;
      }
    }
    
    // Filter buttons - for now just acknowledge, we can implement filtering later
    if (action.action_id.startsWith('filter_')) {
      res.send('');
      return;
    }
    
    // Admin start processing (from detail view)
    if (action.action_id === 'admin_start_processing') {
      const requestId = action.value.split('_')[1];
      
      // Update status
      await supabase
        .from('seed_requests')
        .update({ status: 'processing' })
        .eq('id', requestId);
      
      await fetch('https://slack.com/api/chat.postEphemeral', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SLACK_BOT_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          channel: payload.channel.id,
          user: payload.user.id,
          text: `✅ Request #${requestId} marked as Processing. Type /seedadmin to refresh dashboard.`
        })
      });
      
      res.send('');
      return;
    }
    
    // Admin mark shipped
    if (action.action_id === 'admin_mark_shipped') {
      const requestId = action.value.split('_')[1];
      
      // Update status
      await supabase
        .from('seed_requests')
        .update({ status: 'shipped' })
        .eq('id', requestId);
      
      await fetch('https://slack.com/api/chat.postEphemeral', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SLACK_BOT_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          channel: payload.channel.id,
          user: payload.user.id,
          text: `✅ Request #${requestId} marked as Shipped. Type /seedadmin to refresh dashboard.`
        })
      });
      
      res.send('');
      return;
    }
    
    // Admin delete request
    if (action.action_id === 'admin_delete_request') {
      const requestId = action.value.split('_')[1];
      
      await supabase
        .from('seed_requests')
        .delete()
        .eq('id', requestId);
      
      await fetch('https://slack.com/api/chat.postEphemeral', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SLACK_BOT_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          channel: payload.channel.id,
          user: payload.user.id,
          text: `🗑️ Request #${requestId} deleted. Type /seedadmin to refresh dashboard.`
        })
      });
      
      res.send('');
      return;
    }
    
    if (action.action_id === 'start_processing') {
      const requestId = action.value.split('_')[1];
      
      // Update status to processing
      await supabase
        .from('seed_requests')
        .update({ status: 'processing' })
        .eq('id', requestId);
      
      // Update the message
      const newBlocks = payload.message.blocks.filter(b => b.type !== 'actions');
      newBlocks.push({
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: "✅ Status: *Processing*"
          }
        ]
      });
      newBlocks.push({
        type: "actions",
        block_id: `request_${requestId}`,
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "Mark as Shipped"
            },
            style: "primary",
            value: `ship_${requestId}`,
            action_id: "mark_shipped"
          }
        ]
      });
      
      await fetch('https://slack.com/api/chat.update', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SLACK_BOT_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          channel: payload.channel.id,
          ts: payload.message.ts,
          blocks: newBlocks
        })
      });
      
      res.send('');
      return;
    }
    
    if (action.action_id === 'mark_shipped') {
      // For now, just mark as shipped
      // You can add a modal to collect tracking info later
      const requestId = action.value.split('_')[1];
      
      await supabase
        .from('seed_requests')
        .update({ status: 'shipped' })
        .eq('id', requestId);
      
      const newBlocks = payload.message.blocks.filter(b => b.type !== 'actions' && b.block_id !== `request_${requestId}`);
      newBlocks.push({
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: "✅ Status: *Shipped*"
          }
        ]
      });
      
      await fetch('https://slack.com/api/chat.update', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SLACK_BOT_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          channel: payload.channel.id,
          ts: payload.message.ts,
          blocks: newBlocks
        })
      });
      
      res.send('');
      return;
    }
  }
  
  res.send('');
});

// Keep existing API routes for web dashboard
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
    
    await sendSlackNotification(data[0]);
    
    res.status(201).json(data[0]);
  } catch (error) {
    console.error('Error creating request:', error);
    res.status(500).json({ error: error.message });
  }
});

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
