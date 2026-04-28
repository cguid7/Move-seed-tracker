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

// Generate unique tracking code
function generateTrackingCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed similar looking chars
  let code = 'TR-';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

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
    const callback_id = payload.view.callback_id;
    
    // Handle processing modal submission
    if (callback_id === 'admin_processing_modal') {
      const metadata = JSON.parse(payload.view.private_metadata);
      const requestId = metadata.request_id;
      const values = payload.view.state.values;
      
      const shopifyOrderId = values.shopify_order_id?.value?.value || null;
      
      const updateData = { status: 'processing' };
      if (shopifyOrderId) {
        updateData.shopify_order_id = shopifyOrderId;
      }
      
      await supabase
        .from('seed_requests')
        .update(updateData)
        .eq('id', requestId);
      
      // Send confirmation
      await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SLACK_BOT_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          channel: SLACK_USER_ID,
          text: `✅ Request #${requestId} marked as Processing${shopifyOrderId ? ` (Shopify: ${shopifyOrderId})` : ''}. Type /seedadmin to refresh.`
        })
      });
      
      return res.send('');
    }
    
    // Handle shipped modal submission
    if (callback_id === 'admin_shipped_modal') {
      const metadata = JSON.parse(payload.view.private_metadata);
      const requestId = metadata.request_id;
      const values = payload.view.state.values;
      
      const courier = values.courier?.value?.selected_option?.value;
      const trackingNumber = values.tracking_number?.value?.value;
      
      if (!courier || !trackingNumber) {
        return res.status(200).json({
          response_action: "errors",
          errors: {
            tracking_number: trackingNumber ? null : "Tracking number is required"
          }
        });
      }
      
      await supabase
        .from('seed_requests')
        .update({
          status: 'shipped',
          courier: courier,
          tracking_number: trackingNumber
        })
        .eq('id', requestId);
      
      // Send confirmation
      await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SLACK_BOT_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          channel: SLACK_USER_ID,
          text: `✅ Request #${requestId} marked as Shipped via ${courier} (${trackingNumber}). Type /seedadmin to refresh.`
        })
      });
      
      return res.send('');
    }
    
    // Handle seed request submission
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
      tracking_code: generateTrackingCode(),
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
      
      // Send tracking link to submitter
      const trackingUrl = `${process.env.APP_URL || 'https://move-seed-tracker.onrender.com'}/track/${data[0].tracking_code}`;
      
      await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SLACK_BOT_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          channel: metadata.user_id,
          text: `✅ Your seed request has been submitted!\n\n*Track your request:*\n${trackingUrl}\n\nYou'll receive updates as your request is processed and shipped.`
        })
      });
      
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
    
    // Admin start processing (from detail view) - open modal to collect Shopify ID
    if (action.action_id === 'admin_start_processing') {
      const requestId = action.value.split('_')[1];
      
      // Open modal to collect Shopify Order ID
      const modal = {
        trigger_id: payload.trigger_id,
        view: {
          type: "modal",
          callback_id: "admin_processing_modal",
          private_metadata: JSON.stringify({ request_id: requestId }),
          title: {
            type: "plain_text",
            text: "Start Processing"
          },
          submit: {
            type: "plain_text",
            text: "Update"
          },
          blocks: [
            {
              type: "input",
              block_id: "shopify_order_id",
              optional: true,
              label: {
                type: "plain_text",
                text: "Shopify Order ID"
              },
              element: {
                type: "plain_text_input",
                action_id: "value",
                placeholder: {
                  type: "plain_text",
                  text: "Enter Shopify order number (optional)"
                }
              }
            }
          ]
        }
      };
      
      await fetch('https://slack.com/api/views.open', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SLACK_BOT_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(modal)
      });
      
      res.send('');
      return;
    }
    
    // Admin mark shipped - open modal to collect tracking info
    if (action.action_id === 'admin_mark_shipped') {
      const requestId = action.value.split('_')[1];
      
      // Open modal to collect tracking info
      const modal = {
        trigger_id: payload.trigger_id,
        view: {
          type: "modal",
          callback_id: "admin_shipped_modal",
          private_metadata: JSON.stringify({ request_id: requestId }),
          title: {
            type: "plain_text",
            text: "Mark as Shipped"
          },
          submit: {
            type: "plain_text",
            text: "Update"
          },
          blocks: [
            {
              type: "input",
              block_id: "courier",
              label: {
                type: "plain_text",
                text: "Courier"
              },
              element: {
                type: "static_select",
                action_id: "value",
                placeholder: {
                  type: "plain_text",
                  text: "Select courier"
                },
                options: [
                  {
                    text: {
                      type: "plain_text",
                      text: "UPS"
                    },
                    value: "UPS"
                  },
                  {
                    text: {
                      type: "plain_text",
                      text: "FedEx"
                    },
                    value: "FedEx"
                  },
                  {
                    text: {
                      type: "plain_text",
                      text: "USPS"
                    },
                    value: "USPS"
                  },
                  {
                    text: {
                      type: "plain_text",
                      text: "DHL"
                    },
                    value: "DHL"
                  }
                ]
              }
            },
            {
              type: "input",
              block_id: "tracking_number",
              label: {
                type: "plain_text",
                text: "Tracking Number"
              },
              element: {
                type: "plain_text_input",
                action_id: "value",
                placeholder: {
                  type: "plain_text",
                  text: "Enter tracking number"
                }
              }
            }
          ]
        }
      };
      
      await fetch('https://slack.com/api/views.open', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SLACK_BOT_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(modal)
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

// Tracking page
app.get('/track/:code', async (req, res) => {
  const { code } = req.params;
  
  try {
    const { data: request, error } = await supabase
      .from('seed_requests')
      .select('*')
      .eq('tracking_code', code)
      .single();
    
    if (error || !request) {
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Request Not Found - Move Insole</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              background: linear-gradient(135deg, #340CA6 0%, #F20B5D 50%, #FD892B 100%);
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 20px;
            }
            .container {
              background: white;
              padding: 40px;
              border-radius: 16px;
              max-width: 500px;
              text-align: center;
              box-shadow: 0 8px 30px rgba(0,0,0,0.2);
            }
            h1 { color: #F20B5D; margin-bottom: 20px; }
            p { color: #4a5568; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>❌ Request Not Found</h1>
            <p>We couldn't find a seed request with tracking code: <strong>${code}</strong></p>
            <p>Please check your tracking link and try again.</p>
          </div>
        </body>
        </html>
      `);
      return;
    }
    
    // Format products
    let productsHTML = '';
    if (request.products.insoles && request.products.insoles.length > 0) {
      productsHTML += '<h3>Insoles:</h3><ul>';
      request.products.insoles.forEach(p => {
        productsHTML += `<li>${p.type} - ${p.size} (Qty: ${p.qty})</li>`;
      });
      productsHTML += '</ul>';
    }
    if (request.products.shirts && request.products.shirts.length > 0) {
      productsHTML += '<h3>T-Shirts:</h3><ul>';
      request.products.shirts.forEach(p => {
        productsHTML += `<li>${p.type} - Size ${p.size} (Qty: ${p.qty})</li>`;
      });
      productsHTML += '</ul>';
    }
    if (request.products.socks && request.products.socks.length > 0) {
      productsHTML += '<h3>Socks:</h3><ul>';
      request.products.socks.forEach(p => {
        productsHTML += `<li>${p.type} - ${p.size} (Qty: ${p.qty})</li>`;
      });
      productsHTML += '</ul>';
    }
    
    const getTrackingUrl = (courier, trackingNumber) => {
      const urls = {
        'UPS': `https://www.ups.com/track?tracknum=${trackingNumber}`,
        'FedEx': `https://www.fedex.com/fedextrack/?trknbr=${trackingNumber}`,
        'USPS': `https://tools.usps.com/go/TrackConfirmAction?tLabels=${trackingNumber}`,
        'DHL': `https://www.dhl.com/en/express/tracking.html?AWB=${trackingNumber}`
      };
      return urls[courier] || '#';
    };
    
    const statusColor = request.status === 'pending' ? '#FD892B' : request.status === 'processing' ? '#340CA6' : '#48bb78';
    const statusText = request.status === 'pending' ? 'Pending' : request.status === 'processing' ? 'Processing' : 'Shipped';
    const statusIcon = request.status === 'pending' ? '⏳' : request.status === 'processing' ? '🔄' : '✅';
    
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Track Request ${code} - Move Insole</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #340CA6 0%, #F20B5D 50%, #FD892B 100%);
            min-height: 100vh;
            padding: 20px;
          }
          .container {
            max-width: 800px;
            margin: 0 auto;
          }
          .card {
            background: white;
            border-radius: 16px;
            padding: 30px;
            margin-bottom: 20px;
            box-shadow: 0 8px 30px rgba(0,0,0,0.15);
          }
          h1 {
            background: linear-gradient(90deg, #340CA6 0%, #F20B5D 50%, #FD892B 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            font-size: 2em;
            margin-bottom: 10px;
          }
          .tracking-code {
            color: #718096;
            font-size: 0.9em;
            margin-bottom: 20px;
          }
          .status-badge {
            display: inline-block;
            padding: 10px 20px;
            border-radius: 20px;
            background: ${statusColor};
            color: white;
            font-weight: 700;
            font-size: 1.1em;
            margin: 20px 0;
          }
          .timeline {
            margin: 30px 0;
            position: relative;
          }
          .timeline-item {
            display: flex;
            align-items: center;
            margin: 15px 0;
          }
          .timeline-icon {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.2em;
            margin-right: 15px;
          }
          .active { background: ${statusColor}; color: white; }
          .inactive { background: #e2e8f0; color: #a0aec0; }
          .timeline-text { flex: 1; }
          .timeline-text strong { display: block; margin-bottom: 5px; }
          .timeline-text span { color: #718096; font-size: 0.9em; }
          .info-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin: 20px 0;
          }
          .info-item {
            background: #f7fafc;
            padding: 15px;
            border-radius: 10px;
          }
          .info-label {
            font-size: 0.85em;
            color: #718096;
            font-weight: 700;
            text-transform: uppercase;
            margin-bottom: 5px;
          }
          .info-value {
            color: #2d3748;
            font-weight: 600;
          }
          .products {
            background: #f7fafc;
            padding: 20px;
            border-radius: 10px;
            margin: 20px 0;
          }
          .products h3 {
            color: #340CA6;
            margin: 15px 0 10px 0;
            font-size: 1.1em;
          }
          .products ul {
            list-style: none;
            padding-left: 0;
          }
          .products li {
            padding: 8px 0;
            color: #4a5568;
            border-bottom: 1px solid #e2e8f0;
          }
          .products li:last-child { border-bottom: none; }
          .tracking-link {
            display: inline-block;
            background: linear-gradient(135deg, #340CA6 0%, #F20B5D 100%);
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            text-decoration: none;
            font-weight: 700;
            margin-top: 10px;
          }
          .tracking-link:hover {
            opacity: 0.9;
          }
          @media (max-width: 768px) {
            .info-grid { grid-template-columns: 1fr; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="card">
            <h1>🌱 Seed Request Tracker</h1>
            <div class="tracking-code">Tracking Code: <strong>${code}</strong></div>
            
            <div class="status-badge">${statusIcon} ${statusText}</div>
            
            <div class="timeline">
              <div class="timeline-item">
                <div class="timeline-icon ${request.status ? 'active' : 'inactive'}">📝</div>
                <div class="timeline-text">
                  <strong>Submitted</strong>
                  <span>${new Date(request.created_at).toLocaleDateString()} at ${new Date(request.created_at).toLocaleTimeString()}</span>
                </div>
              </div>
              
              <div class="timeline-item">
                <div class="timeline-icon ${request.status === 'processing' || request.status === 'shipped' ? 'active' : 'inactive'}">🔄</div>
                <div class="timeline-text">
                  <strong>Processing</strong>
                  <span>${request.status === 'processing' || request.status === 'shipped' ? 'Order being prepared' : 'Waiting to be processed'}</span>
                </div>
              </div>
              
              <div class="timeline-item">
                <div class="timeline-icon ${request.status === 'shipped' ? 'active' : 'inactive'}">📦</div>
                <div class="timeline-text">
                  <strong>Shipped</strong>
                  <span>${request.status === 'shipped' ? 'Order is on the way!' : 'Not yet shipped'}</span>
                </div>
              </div>
            </div>
            
            <h2 style="color: #2d3748; margin: 30px 0 15px 0;">Request Details</h2>
            
            <div class="info-grid">
              <div class="info-item">
                <div class="info-label">Recipient</div>
                <div class="info-value">${request.recipient.name}</div>
              </div>
              
              <div class="info-item">
                <div class="info-label">Email</div>
                <div class="info-value">${request.recipient.email}</div>
              </div>
              
              ${request.shopify_order_id ? `
              <div class="info-item">
                <div class="info-label">Order ID</div>
                <div class="info-value">${request.shopify_order_id}</div>
              </div>
              ` : ''}
              
              ${request.tracking_number ? `
              <div class="info-item">
                <div class="info-label">Tracking</div>
                <div class="info-value">${request.courier || 'Unknown'}: ${request.tracking_number}</div>
              </div>
              ` : ''}
            </div>
            
            ${request.tracking_number && request.courier ? `
              <a href="${getTrackingUrl(request.courier, request.tracking_number)}" target="_blank" class="tracking-link">
                📍 Track Shipment on ${request.courier}
              </a>
            ` : ''}
            
            <div class="products">
              <h2 style="color: #2d3748; margin: 0 0 15px 0;">Products</h2>
              ${productsHTML || '<p>No products listed</p>'}
            </div>
            
            ${request.notes ? `
            <div class="info-item" style="margin-top: 20px;">
              <div class="info-label">Notes</div>
              <div class="info-value">${request.notes}</div>
            </div>
            ` : ''}
          </div>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('Error fetching tracking info:', error);
    res.status(500).send('Error loading tracking information');
  }
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
      tracking_code: generateTrackingCode(),
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
