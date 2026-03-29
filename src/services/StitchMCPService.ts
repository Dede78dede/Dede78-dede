export interface StitchDesignRequest {
  prompt: string;
  theme?: 'light' | 'dark' | 'system';
  colorPalette?: string[];
  context?: string; // Additional context from the agent/user
}

export interface StitchDesignResponse {
  id: string;
  status: 'pending' | 'completed' | 'failed';
  html?: string;
  css?: string;
  figmaUrl?: string;
  previewUrl?: string;
  error?: string;
}

type EventCallback = (data: any) => void;

/**
 * Mock Service for Google Stitch Integration via MCP.
 * This simulates the interaction with the stitch.withgoogle.com API.
 * In the future, this will be replaced with actual API calls or MCP client calls.
 */
export class StitchMCPService {
  private static instance: StitchMCPService;
  private isConnected: boolean = false;
  private mockDesigns: Map<string, StitchDesignResponse> = new Map();
  private listeners: Map<string, EventCallback[]> = new Map();

  private constructor() {}

  public static getInstance(): StitchMCPService {
    if (!StitchMCPService.instance) {
      StitchMCPService.instance = new StitchMCPService();
    }
    return StitchMCPService.instance;
  }

  public on(event: string, callback: EventCallback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  public off(event: string, callback: EventCallback) {
    if (!this.listeners.has(event)) return;
    const callbacks = this.listeners.get(event)!.filter(cb => cb !== callback);
    this.listeners.set(event, callbacks);
  }

  private emit(event: string, data?: any) {
    if (!this.listeners.has(event)) return;
    this.listeners.get(event)!.forEach(cb => cb(data));
  }

  /**
   * Simulates connecting to the Stitch MCP server using the user's Google Auth token.
   */
  public async connect(googleAuthToken: string): Promise<boolean> {
    console.log('[StitchMCP] Connecting to Google Stitch with token...', googleAuthToken.substring(0, 10) + '...');
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    this.isConnected = true;
    this.emit('connected');
    console.log('[StitchMCP] Connected successfully.');
    return true;
  }

  /**
   * Generates a UI design based on a natural language prompt.
   */
  public async generateDesign(request: StitchDesignRequest): Promise<StitchDesignResponse> {
    if (!this.isConnected) {
      throw new Error("StitchMCPService is not connected. Call connect() first with a valid Google Auth token.");
    }

    console.log(`[StitchMCP] Generating design for prompt: "${request.prompt}"`);
    
    const designId = `stitch-design-${Date.now()}`;
    const pendingResponse: StitchDesignResponse = {
      id: designId,
      status: 'pending'
    };
    
    this.mockDesigns.set(designId, pendingResponse);

    // Simulate the generation process (takes a few seconds)
    setTimeout(() => {
      this.completeMockDesign(designId, request);
    }, 3000);

    return pendingResponse;
  }

  /**
   * Checks the status of a pending design generation.
   */
  public async checkStatus(designId: string): Promise<StitchDesignResponse> {
    const design = this.mockDesigns.get(designId);
    if (!design) {
      throw new Error(`Design with ID ${designId} not found.`);
    }
    return design;
  }

  /**
   * Simulates the completion of a design generation with mock HTML/CSS.
   */
  private completeMockDesign(designId: string, request: StitchDesignRequest) {
    const isDark = request.theme === 'dark' || request.prompt.toLowerCase().includes('dark');
    const bgColor = isDark ? '#09090b' : '#ffffff';
    const textColor = isDark ? '#f4f4f5' : '#18181b';
    const primaryColor = request.colorPalette?.[0] || '#10b981'; // Default Emerald
    const secondaryColor = request.colorPalette?.[1] || '#3b82f6'; // Default Blue
    const cardBg = isDark ? '#18181b' : '#f4f4f5';
    const borderColor = isDark ? '#27272a' : '#e4e4e7';

    // Simple heuristic to generate different components based on keywords
    const promptLower = request.prompt.toLowerCase();
    const hasChart = promptLower.includes('grafico') || promptLower.includes('chart');
    const hasTable = promptLower.includes('tabella') || promptLower.includes('table');
    const hasCards = promptLower.includes('card') || promptLower.includes('metriche');
    const hasSidebar = promptLower.includes('sidebar') || promptLower.includes('navigazione');

    let contentHtml = '';

    if (hasCards || (!hasChart && !hasTable)) {
      contentHtml += `
      <div class="stitch-grid">
        <div class="stitch-card">
          <h3>Utenti Attivi</h3>
          <div class="stitch-metric">1,234</div>
          <p class="stitch-trend positive">+12% rispetto a ieri</p>
        </div>
        <div class="stitch-card">
          <h3>Entrate</h3>
          <div class="stitch-metric">€4,560</div>
          <p class="stitch-trend positive">+5% rispetto a ieri</p>
        </div>
        <div class="stitch-card">
          <h3>Errori</h3>
          <div class="stitch-metric">23</div>
          <p class="stitch-trend negative">-2% rispetto a ieri</p>
        </div>
      </div>`;
    }

    if (hasChart) {
      contentHtml += `
      <div class="stitch-card stitch-chart-container">
        <h3>Andamento Settimanale</h3>
        <div class="stitch-chart-placeholder">
          <div class="stitch-bar" style="height: 40%"></div>
          <div class="stitch-bar" style="height: 60%"></div>
          <div class="stitch-bar" style="height: 30%"></div>
          <div class="stitch-bar" style="height: 80%"></div>
          <div class="stitch-bar" style="height: 50%"></div>
          <div class="stitch-bar" style="height: 90%"></div>
          <div class="stitch-bar" style="height: 70%"></div>
        </div>
      </div>`;
    }

    if (hasTable) {
      contentHtml += `
      <div class="stitch-card">
        <h3>Ultimi Ordini</h3>
        <table class="stitch-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Cliente</th>
              <th>Stato</th>
              <th>Totale</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>#1024</td>
              <td>Mario Rossi</td>
              <td><span class="stitch-badge success">Completato</span></td>
              <td>€120.00</td>
            </tr>
            <tr>
              <td>#1025</td>
              <td>Giulia Bianchi</td>
              <td><span class="stitch-badge warning">In Lavorazione</span></td>
              <td>€45.50</td>
            </tr>
            <tr>
              <td>#1026</td>
              <td>Luca Verdi</td>
              <td><span class="stitch-badge error">Annullato</span></td>
              <td>€0.00</td>
            </tr>
          </tbody>
        </table>
      </div>`;
    }

    const mockHtml = `
<div class="stitch-container">
<div class="stitch-layout ${hasSidebar ? 'has-sidebar' : ''}">
  ${hasSidebar ? `
  <aside class="stitch-sidebar">
    <div class="stitch-logo">Stitch UI</div>
    <nav class="stitch-nav">
      <a href="#" class="active">Dashboard</a>
      <a href="#">Analitiche</a>
      <a href="#">Impostazioni</a>
    </nav>
  </aside>
  ` : ''}
  <div class="stitch-main">
    <header class="stitch-header">
      <div>
        <h1>Interfaccia Generata</h1>
        <p class="stitch-subtitle">Prompt: "${request.prompt}"</p>
      </div>
      <button class="stitch-btn">Nuova Azione</button>
    </header>
    <div class="stitch-content">
      ${contentHtml}
    </div>
  </div>
</div>
</div>
    `.trim();

    const mockCss = `
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: system-ui, -apple-system, sans-serif;
  background-color: ${bgColor};
  color: ${textColor};
  line-height: 1.5;
}
.stitch-layout {
  display: flex;
  min-height: 100vh;
}
.stitch-layout.has-sidebar .stitch-main {
  flex: 1;
}
.stitch-sidebar {
  width: 250px;
  background-color: ${cardBg};
  border-right: 1px solid ${borderColor};
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 2rem;
}
.stitch-logo {
  font-size: 1.25rem;
  font-weight: bold;
  color: ${primaryColor};
}
.stitch-nav {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.stitch-nav a {
  text-decoration: none;
  color: ${textColor};
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  opacity: 0.8;
  transition: all 0.2s;
}
.stitch-nav a:hover, .stitch-nav a.active {
  background-color: ${primaryColor}20;
  color: ${primaryColor};
  opacity: 1;
}
.stitch-main {
  padding: 2rem;
  width: 100%;
}
.stitch-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid ${borderColor};
}
.stitch-header h1 {
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: 0.25rem;
}
.stitch-subtitle {
  color: ${textColor}80;
  font-size: 0.875rem;
}
.stitch-btn {
  background-color: ${primaryColor};
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.2s;
}
.stitch-btn:hover {
  opacity: 0.9;
}
.stitch-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}
.stitch-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 1.5rem;
}
.stitch-card {
  background-color: ${cardBg};
  border: 1px solid ${borderColor};
  border-radius: 0.5rem;
  padding: 1.5rem;
}
.stitch-card h3 {
  font-size: 0.875rem;
  font-weight: 500;
  color: ${textColor}80;
  margin-bottom: 0.5rem;
}
.stitch-metric {
  font-size: 2rem;
  font-weight: 700;
  margin-bottom: 0.25rem;
}
.stitch-trend {
  font-size: 0.75rem;
  font-weight: 500;
}
.stitch-trend.positive { color: ${primaryColor}; }
.stitch-trend.negative { color: #ef4444; }
.stitch-chart-container {
  height: 300px;
  display: flex;
  flex-direction: column;
}
.stitch-chart-placeholder {
  flex: 1;
  display: flex;
  align-items: flex-end;
  gap: 1rem;
  padding-top: 1rem;
}
.stitch-bar {
  flex: 1;
  background-color: ${primaryColor};
  border-radius: 4px 4px 0 0;
  opacity: 0.8;
  transition: opacity 0.2s;
}
.stitch-bar:hover {
  opacity: 1;
}
.stitch-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 1rem;
}
.stitch-table th, .stitch-table td {
  padding: 0.75rem;
  text-align: left;
  border-bottom: 1px solid ${borderColor};
}
.stitch-table th {
  font-weight: 500;
  color: ${textColor}80;
  font-size: 0.875rem;
}
.stitch-badge {
  padding: 0.25rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
}
.stitch-badge.success { background-color: ${primaryColor}20; color: ${primaryColor}; }
.stitch-badge.warning { background-color: #f59e0b20; color: #f59e0b; }
.stitch-badge.error { background-color: #ef444420; color: #ef4444; }
    `.trim();

    const completedResponse: StitchDesignResponse = {
      id: designId,
      status: 'completed',
      html: mockHtml,
      css: mockCss,
      figmaUrl: 'https://figma.com/file/mock-stitch-export',
      previewUrl: `/api/stitch/preview/${designId}`
    };

    this.mockDesigns.set(designId, completedResponse);
    this.emit('designCompleted', completedResponse);
    console.log(`[StitchMCP] Design ${designId} completed.`);
  }
}

export const stitchService = StitchMCPService.getInstance();
