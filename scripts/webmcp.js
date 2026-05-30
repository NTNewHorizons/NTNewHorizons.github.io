(function () {
  if (typeof navigator.modelContext === 'undefined' ||
      typeof navigator.modelContext.provideContext !== 'function') {
    return;
  }

  navigator.modelContext.provideContext({
    tools: [
      {
        name: 'navigate_to',
        description: 'Navigate to a page on NTNewHorizons',
        inputSchema: {
          type: 'object',
          properties: {
            page: {
              type: 'string',
              enum: ['/', '/about', '/download', '/guide', '/blog'],
              description: 'The page to navigate to'
            }
          },
          required: ['page']
        },
        execute: async function (input) {
          window.location.href = input.page;
          return { success: true, page: input.page };
        }
      },
      {
        name: 'search_downloads',
        description: 'Get download links for the modpack',
        inputSchema: {
          type: 'object',
          properties: {
            version: {
              type: 'string',
              description: 'Optional version filter'
            }
          }
        },
        execute: async function () {
          window.location.href = '/download';
          return { success: true, message: 'Navigated to download page' };
        }
      },
      {
        name: 'read_guide',
        description: 'Open the getting started guide',
        inputSchema: {
          type: 'object',
          properties: {}
        },
        execute: async function () {
          window.location.href = '/guide';
          return { success: true, message: 'Navigated to guide page' };
        }
      },
      {
        name: 'open_discord',
        description: 'Open the community Discord server invite',
        inputSchema: {
          type: 'object',
          properties: {}
        },
        execute: async function () {
          window.open('https://discord.gg/wtNVzeE5QB', '_blank');
          return { success: true, message: 'Opened Discord invite' };
        }
      }
    ]
  });
})();
