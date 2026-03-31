import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { stitchService, StitchDesignResponse } from '../../../services/StitchMCPService';
import { memorySystem } from '../../../services/MemorySystem';

export function useStitchDesignLogic() {
  const { user, login } = useAuth();
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentDesign, setCurrentDesign] = useState<StitchDesignResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'preview' | 'code'>('preview');
  const [isConnected, setIsConnected] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Connect to Stitch MCP when user is available
    const connectStitch = async () => {
      if (user) {
        try {
          const token = await user.getIdToken();
          await stitchService.connect(token);
          setIsConnected(true);
        } catch (err) {
          console.error("Failed to connect to Stitch:", err);
          setError("Impossibile connettersi a Google Stitch. Riprova più tardi.");
        }
      }
    };

    connectStitch();

    const handleDesignComplete = (design: StitchDesignResponse) => {
      setCurrentDesign(design);
      setIsGenerating(false);
      
      // Cache the generated design in MemorySystem
      if (design.html && design.css) {
        const combinedCode = `<!-- HTML -->\n${design.html}\n\n/* CSS */\n${design.css}`;
        memorySystem.remember(`stitch_design_${prompt}`, combinedCode);
      }
    };

    stitchService.on('designCompleted', handleDesignComplete);

    return () => {
      stitchService.off('designCompleted', handleDesignComplete);
    };
  }, [user, prompt]);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    if (!user) {
      login(); // Prompt login if not authenticated
      return;
    }

    setIsGenerating(true);
    setError(null);
    setCurrentDesign(null);

    try {
      // Check cache first
      const cachedResult = await memorySystem.recall(`stitch_design_${prompt}`);
      if (cachedResult) {
        // Parse the cached HTML and CSS
        const htmlMatch = cachedResult.response.match(/<!-- HTML -->\n([\s\S]*?)\n\n\/\* CSS \*\//);
        const cssMatch = cachedResult.response.match(/\/\* CSS \*\/\n([\s\S]*)/);
        
        if (htmlMatch && cssMatch) {
          setCurrentDesign({
            id: `cached-${Date.now()}`,
            status: 'completed',
            html: htmlMatch[1],
            css: cssMatch[1],
            previewUrl: '#',
            figmaUrl: '#'
          });
          setIsGenerating(false);
          return;
        }
      }

      const pendingDesign = await stitchService.generateDesign({
        prompt,
        theme: 'dark', // Defaulting to dark for this app's aesthetic
      });
      
      // The actual completion will be handled by the 'designCompleted' event listener
      console.log("Design generation started:", pendingDesign.id);
    } catch (err: any) {
      setError(err.message || "Errore durante la generazione del design.");
      setIsGenerating(false);
    }
  };

  const handleSendToAntiGravity = () => {
    if (!currentDesign) return;
    
    const combinedCode = `
<!-- HTML -->
${currentDesign.html}

/* CSS */
${currentDesign.css}
    `.trim();

    // Navigate to inference page and pass the code as state
    navigate('/inference', { state: { initialPrompt: `Ho generato questa UI con Google Stitch. Puoi ottimizzarla e trasformarla in un componente React?\n\n\`\`\`html\n${combinedCode}\n\`\`\`` } });
  };

  return {
    user,
    login,
    prompt,
    setPrompt,
    isGenerating,
    currentDesign,
    error,
    activeTab,
    setActiveTab,
    isConnected,
    handleGenerate,
    handleSendToAntiGravity
  };
}
