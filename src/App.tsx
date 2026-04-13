/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Trash2, 
  ExternalLink, 
  Play, 
  Search, 
  Filter, 
  CheckCircle2, 
  AlertCircle, 
  Info,
  Youtube,
  LayoutGrid,
  Clock,
  FileText,
  Copy,
  ImageIcon,
  Sparkles,
  X,
  Loader2
} from 'lucide-react';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  doc, 
  query, 
  orderBy, 
  serverTimestamp,
  setDoc
} from 'firebase/firestore';
import { db } from './firebase';
import Groq from "groq-sdk";

// --- Types ---

interface Video {
  id: string;
  firestoreId?: string;
  title: string;
  thumbnail: string;
  resumo: string;
  url: string;
  categoria: string;
  date: string;
  createdAt?: any;
}

interface ArticleData {
  summary: string;
  seoArticle: string;
  keywords: string[];
}

interface Toast {
  id: number;
  title: string;
  message: string;
  type: 'success' | 'error' | 'warning';
}

// --- Constants ---

const DEFAULT_CATEGORIES = [
  "Tecnologia",
  "Marketing",
  "Design",
  "Negócios",
  "Educação",
  "Entretenimento",
  "Outros"
];

// --- Helpers ---

function getYouTubeID(url: string) {
  const regExp = /(?:youtube\.com\/.*v=|youtu\.be\/)([^&]+)/;
  const match = url.match(regExp);
  return match ? match[1] : null;
}

async function fetchVideoData(url: string): Promise<Partial<Video> | null> {
  const videoId = getYouTubeID(url);
  if (!videoId) return null;

  try {
    const res = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`);
    const data = await res.json();

    return {
      id: videoId,
      title: data.title || "Vídeo",
      thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      resumo: data.title ? data.title.substring(0, 100) + "..." : "Sem descrição disponível",
      url: url,
      date: new Date().toISOString()
    };
  } catch {
    return {
      id: videoId,
      title: "Vídeo",
      thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      resumo: "Resumo não disponível",
      url: url,
      date: new Date().toISOString()
    };
  }
}

// --- Components ---

export default function App() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [url, setUrl] = useState('');
  const [categoria, setCategoria] = useState(DEFAULT_CATEGORIES[0]);
  const [newCategory, setNewCategory] = useState('');
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  
  // Article Generator State
  const [selectedVideoForArticle, setSelectedVideoForArticle] = useState<Video | null>(null);
  const [isGeneratingArticle, setIsGeneratingArticle] = useState(false);
  const [generatedArticle, setGeneratedArticle] = useState<ArticleData | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [customArticleImage, setCustomArticleImage] = useState<string | null>(null);
  const [showImageInput, setShowImageInput] = useState(false);

  // Load from Firestore
  useEffect(() => {
    const vQuery = query(collection(db, "videos"), orderBy("createdAt", "desc"));
    const unsubscribeVideos = onSnapshot(vQuery, (snapshot) => {
      const videoList = snapshot.docs.map(doc => {
        const data = doc.data();
        // Tenta extrair o ID do YouTube de várias fontes para garantir compatibilidade
        const youtubeId = data.id || getYouTubeID(data.url) || doc.id;
        return {
          ...data,
          id: youtubeId,
          firestoreId: doc.id
        };
      }) as Video[];
      setVideos(videoList);
    }, (error) => {
      console.error("Firestore Error (Videos):", error);
    });

    const cQuery = query(collection(db, "categories"), orderBy("name", "asc"));
    const unsubscribeCategories = onSnapshot(cQuery, (snapshot) => {
      if (snapshot.empty) {
        // Initialize default categories if none exist
        DEFAULT_CATEGORIES.forEach(async (cat) => {
          await setDoc(doc(db, "categories", cat), { name: cat });
        });
      } else {
        const catList = snapshot.docs.map(doc => doc.data().name as string);
        setCategories(catList);
      }
    }, (error) => {
      console.error("Firestore Error (Categories):", error);
    });

    return () => {
      unsubscribeVideos();
      unsubscribeCategories();
    };
  }, []);

  const showToast = (title: string, message: string, type: Toast['type'] = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, title, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  const handleAddVideo = async () => {
    if (!url.trim()) {
      showToast("Erro", "Por favor, insira uma URL válida.", "error");
      return;
    }

    setIsAdding(true);
    const videoData = await fetchVideoData(url);

    if (!videoData || !videoData.id) {
      showToast("Erro", "Link inválido! Verifique a URL do YouTube.", "error");
      setIsAdding(false);
      return;
    }

    if (videos.some(v => v.id === videoData.id)) {
      showToast("Aviso", "Este vídeo já está na sua coleção!", "warning");
      setIsAdding(false);
      return;
    }

    try {
      // Usamos o ID do próprio vídeo como ID do documento para evitar duplicatas
      await setDoc(doc(db, "videos", videoData.id!), {
        ...videoData,
        categoria,
        createdAt: serverTimestamp()
      });
      setUrl('');
      setIsAdding(false);
      showToast("Sucesso", "Vídeo adicionado à sua coleção!");
    } catch (error) {
      console.error("Error adding video:", error);
      showToast("Erro", "Não foi possível salvar o vídeo no banco de dados.", "error");
      setIsAdding(false);
    }
  };

  const handleAddCategory = async () => {
    if (!newCategory.trim()) return;
    if (categories.includes(newCategory.trim())) {
      showToast("Aviso", "Esta categoria já existe!", "warning");
      return;
    }
    
    try {
      await setDoc(doc(db, "categories", newCategory.trim()), {
        name: newCategory.trim()
      });
      setCategoria(newCategory.trim());
      setNewCategory('');
      setShowNewCategoryInput(false);
      showToast("Sucesso", "Nova categoria adicionada!");
    } catch (error) {
      console.error("Error adding category:", error);
      showToast("Erro", "Falha ao salvar categoria.", "error");
    }
  };

  const handleDeleteVideo = async (firestoreId: string) => {
    try {
      await deleteDoc(doc(db, "videos", firestoreId));
      showToast("Removido", "Vídeo removido da coleção.", "warning");
    } catch (error) {
      console.error("Error deleting video:", error);
      showToast("Erro", "Falha ao remover vídeo.", "error");
    }
  };

  const generateSEOArticle = async (video: Video) => {
    setIsGeneratingArticle(true);
    setGenerationError(null);
    setSelectedVideoForArticle(video);
    setCustomArticleImage(video.thumbnail);
    setGeneratedArticle(null);

    try {
      // Usando a chave fornecida pelo usuário diretamente para garantir funcionamento no Netlify
      // Em produção, o ideal é usar import.meta.env.VITE_GROQ_API_KEY
      const apiKey = import.meta.env.VITE_GROQ_API_KEY || "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";
      
      const groq = new Groq({
        apiKey: apiKey,
        dangerouslyAllowBrowser: true // Necessário para rodar no navegador (Netlify)
      });

      const prompt = `
        Você é um redator sênior especialista em SEO e Marketing de Conteúdo Digital.
        Sua tarefa é criar um conteúdo de alta qualidade em PORTUGUÊS (Brasil) baseado no vídeo: "${video.title}" (Categoria: ${video.categoria}).

        Retorne um objeto JSON com EXATAMENTE estas chaves:
        1. "summary": Um resumo executivo da transcrição do vídeo, destacando os pontos principais de forma didática (mínimo 150 palavras).
        2. "seoArticle": Um artigo de blog completo, otimizado para SEO, com 600 a 800 palavras. 
           - Use títulos H2 e H3 atraentes.
           - Use listas (bullet points) para facilitar a leitura.
           - Aplique técnicas de copywriting (AIDA ou PAS).
           - O tom deve ser profissional e informativo.
        3. "keywords": Um array com as 10 melhores palavras-chave para este conteúdo.

        IMPORTANTE: Responda APENAS o JSON puro, sem textos explicativos antes ou depois. Não use blocos de código markdown (como \`\`\`json).
      `;

      const chatCompletion = await groq.chat.completions.create({
        messages: [
          {
            role: "system",
            content: "Você é um assistente que gera apenas saídas em formato JSON válido em Português.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        model: "llama-3.3-70b-versatile",
        response_format: { type: "json_object" },
        temperature: 0.7,
      });

      const content = chatCompletion.choices[0]?.message?.content;
      
      if (!content) {
        throw new Error("A IA não retornou nenhum conteúdo. Tente novamente.");
      }

      const data = JSON.parse(content);

      if (!data.summary || !data.seoArticle) {
        throw new Error('A IA retornou um formato incompleto. Tente novamente.');
      }

      setGeneratedArticle(data);
      showToast("Sucesso", "Artigo SEO gerado com sucesso!");
    } catch (error) {
      console.error("Erro ao gerar artigo:", error);
      const msg = error instanceof Error ? error.message : "Erro na comunicação com a Groq.";
      setGenerationError(msg);
      showToast("Erro", "Falha na geração do artigo.", "error");
    } finally {
      setIsGeneratingArticle(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast("Copiado", "Conteúdo copiado para a área de transferência!");
  };

  const filteredVideos = useMemo(() => {
    return videos.filter(v => {
      const matchesSearch = v.title.toLowerCase().includes(search.toLowerCase()) || 
                           v.categoria.toLowerCase().includes(search.toLowerCase());
      const matchesFilter = filter === 'All' || v.categoria === filter;
      return matchesSearch && matchesFilter;
    });
  }, [videos, search, filter]);

  const groupedVideos = useMemo(() => {
    const groups: Record<string, Video[]> = {};
    filteredVideos.forEach(v => {
      if (!groups[v.categoria]) groups[v.categoria] = [];
      groups[v.categoria].push(v);
    });
    return Object.entries(groups).sort((a, b) => b[1].length - a[1].length);
  }, [filteredVideos]);

  return (
    <div className="relative min-h-screen pb-20">
      {/* Background Elements */}
      <div className="fixed inset-0 z-[-1] bg-darker overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_20%_80%,rgba(0,240,255,0.15)_0%,transparent_50%),radial-gradient(ellipse_at_80%_20%,rgba(255,0,255,0.15)_0%,transparent_50%),radial-gradient(ellipse_at_40%_40%,rgba(255,215,0,0.05)_0%,transparent_50%)]" />
        <div className="grid-overlay absolute inset-0 opacity-30" />
      </div>

      {/* Header */}
      <header className="pt-16 pb-12 px-4 text-center relative flex flex-col items-center">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <h1 className="font-display text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter bg-gradient-to-br from-primary via-secondary to-accent bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(0,240,255,0.3)] relative inline-block">
            NEXUS
            <span className="absolute inset-0 blur-2xl opacity-30 bg-gradient-to-br from-primary to-secondary -z-10" aria-hidden="true">NEXUS</span>
          </h1>
          <p className="mt-4 text-sm md:text-base tracking-[0.5em] uppercase text-white/50 font-medium">
            Sia Site Video Hub
          </p>
        </motion.div>

        {/* Analisador-Vídeo-Pro Button */}
        <div className="mt-8 md:mt-0 md:absolute md:top-6 md:right-6 z-50">
          <motion.a
            href="https://analisador-youtube.netlify.app"
            target="_blank"
            rel="noopener noreferrer"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.95 }}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-primary via-secondary to-accent text-darker font-display font-bold text-[10px] md:text-xs uppercase tracking-widest shadow-[0_0_20px_rgba(0,240,255,0.4)] hover:shadow-[0_0_30px_rgba(0,240,255,0.6)] transition-all group"
          >
            <Sparkles size={14} className="group-hover:animate-pulse" />
            <span>Analisador-Vídeo-Pro</span>
            <ExternalLink size={12} />
          </motion.a>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 md:px-8">
        
        {/* Input Section */}
        <section className="mb-16">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass p-6 md:p-10 rounded-[2rem] neon-border relative overflow-hidden group"
          >
            {/* Scanline effect */}
            <div className="absolute top-0 left-[-100%] w-full h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent animate-[scanline_3s_linear_infinite]" />
            
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px_160px] gap-6 items-end">
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest text-primary font-bold flex items-center gap-2">
                  <Youtube size={12} /> URL do YouTube
                </label>
                <div className="relative">
                  <input 
                    type="text" 
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddVideo()}
                    placeholder="Cole o link do vídeo aqui..."
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-5 py-4 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all placeholder:text-white/20"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] uppercase tracking-widest text-primary font-bold flex items-center gap-2">
                    <LayoutGrid size={12} /> Categoria
                  </label>
                  <button 
                    onClick={() => setShowNewCategoryInput(!showNewCategoryInput)}
                    className="text-[10px] text-white/40 hover:text-primary transition-colors flex items-center gap-1"
                  >
                    {showNewCategoryInput ? "Cancelar" : "+ Nova"}
                  </button>
                </div>
                
                {showNewCategoryInput ? (
                  <div className="flex gap-2">
                    <input 
                      type="text"
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleAddCategory()}
                      placeholder="Nome..."
                      autoFocus
                      className="w-full bg-black/40 border border-primary/30 rounded-xl px-4 py-4 focus:outline-none focus:border-primary transition-all"
                    />
                    <button 
                      onClick={handleAddCategory}
                      className="bg-primary text-darker px-4 rounded-xl font-bold hover:bg-accent transition-colors"
                    >
                      <Plus size={20} />
                    </button>
                  </div>
                ) : (
                  <select 
                    value={categoria}
                    onChange={(e) => setCategoria(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-5 py-4 focus:outline-none focus:border-primary transition-all appearance-none cursor-pointer"
                  >
                    {categories.map(cat => (
                      <option key={cat} value={cat} className="bg-darker">{cat}</option>
                    ))}
                  </select>
                )}
              </div>

              <button 
                onClick={handleAddVideo}
                disabled={isAdding}
                className="w-full bg-gradient-to-br from-primary to-secondary text-darker font-display font-bold py-4 rounded-xl shadow-[0_10px_30px_rgba(0,240,255,0.3)] hover:translate-y-[-2px] hover:shadow-[0_15px_40px_rgba(0,240,255,0.5)] active:translate-y-0 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isAdding ? (
                  <div className="w-5 h-5 border-2 border-darker/30 border-t-darker rounded-full animate-spin" />
                ) : (
                  <>
                    <Plus size={18} />
                    <span>Adicionar</span>
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </section>

        {/* Toolbar: Search & Filter */}
        <div className="flex flex-col md:flex-row gap-4 mb-12 items-center justify-between">
          <div className="relative w-full md:w-96 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-primary transition-colors" size={18} />
            <input 
              type="text" 
              placeholder="Pesquisar vídeos ou categorias..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-full pl-12 pr-6 py-3 focus:outline-none focus:border-primary/50 transition-all"
            />
          </div>

          <div className="flex items-center gap-3 overflow-x-auto pb-2 w-full md:w-auto no-scrollbar">
            <Filter size={16} className="text-white/30 shrink-0" />
            <button 
              onClick={() => setFilter('All')}
              className={`px-5 py-2 rounded-full text-xs font-bold tracking-wider uppercase transition-all shrink-0 ${filter === 'All' ? 'bg-primary text-darker' : 'bg-white/5 text-white/50 hover:bg-white/10'}`}
            >
              Todos
            </button>
            {categories.map(cat => (
              <button 
                key={cat}
                onClick={() => setFilter(cat)}
                className={`px-5 py-2 rounded-full text-xs font-bold tracking-wider uppercase transition-all shrink-0 ${filter === cat ? 'bg-primary text-darker' : 'bg-white/5 text-white/50 hover:bg-white/10'}`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Video Grid */}
        <div className="space-y-12">
          {filteredVideos.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <AnimatePresence mode="popLayout">
                {filteredVideos.map((v, idx) => (
                  <motion.div
                    key={v.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.4, delay: idx * 0.05 }}
                    className="group"
                  >
                    <div className="glass rounded-2xl overflow-hidden neon-border/0 hover:neon-border transition-all duration-500 flex flex-col h-full relative group/card">
                      {/* Thumbnail */}
                      <div 
                        className="aspect-video relative overflow-hidden cursor-pointer"
                        onClick={() => setActiveVideoId(v.id)}
                      >
                        <img 
                          src={v.thumbnail} 
                          alt={v.title}
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-darker via-transparent to-transparent opacity-60" />
                        
                        {/* Play Overlay */}
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                          <div className="w-16 h-16 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center shadow-2xl scale-75 group-hover:scale-100 transition-transform duration-500">
                            <Play size={24} className="text-darker fill-darker ml-1" />
                          </div>
                        </div>

                        {/* Category Badge */}
                        <div className="absolute top-3 left-3 bg-primary/20 backdrop-blur-md border border-primary/30 px-2 py-1 rounded-md text-[9px] font-bold text-primary uppercase tracking-widest">
                          {v.categoria}
                        </div>

                        {/* Date Badge */}
                        <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md border border-white/10 px-2 py-1 rounded-md text-[9px] font-mono text-white/70 flex items-center gap-1">
                          <Clock size={10} />
                          {v.createdAt?.toDate 
                            ? v.createdAt.toDate().toLocaleDateString() 
                            : (v.date ? new Date(v.date).toLocaleDateString() : new Date().toLocaleDateString())}
                        </div>
                      </div>

                      {/* Content */}
                      <div className="p-6 flex flex-col flex-grow">
                        <h3 
                          className="font-display text-sm font-bold leading-tight mb-3 line-clamp-2 group-hover:text-primary transition-colors cursor-pointer"
                          onClick={() => setActiveVideoId(v.id)}
                        >
                          {v.title}
                        </h3>
                        <p className="text-xs text-white/50 leading-relaxed mb-6 line-clamp-2 font-body">
                          {v.resumo}
                        </p>

                        <div className="mt-auto flex flex-col gap-4">
                          <div className="flex items-center justify-between">
                            <button 
                              onClick={() => setActiveVideoId(v.id)}
                              className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-primary hover:text-accent transition-colors"
                            >
                              Assistir <Play size={12} className="fill-current" />
                            </button>
                            <button 
                              onClick={() => handleDeleteVideo(v.firestoreId || v.id)}
                              className="p-2 text-white/20 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                              title="Remover vídeo"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                          
                          <button 
                            onClick={() => generateSEOArticle(v)}
                            className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-white/5 border border-white/10 text-[10px] font-bold uppercase tracking-widest text-white/70 hover:bg-primary/10 hover:border-primary/30 hover:text-primary transition-all group/btn"
                          >
                            <Sparkles size={14} className="group-hover/btn:animate-pulse" />
                            Gerar Artigo SEO
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          ) : (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-32 text-center"
            >
              <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-white/5 border border-white/10 mb-6">
                <Youtube size={40} className="text-white/20" />
              </div>
              <h3 className="font-display text-xl font-bold mb-2">Nenhum vídeo encontrado</h3>
              <p className="text-white/40 max-w-xs mx-auto text-sm">
                {videos.length === 0 
                  ? "Sua coleção está vazia. Adicione seu primeiro tutorial acima!" 
                  : "Nenhum vídeo corresponde aos seus critérios de busca."}
              </p>
            </motion.div>
          )}
        </div>
      </main>

      {/* Video Modal */}
      <AnimatePresence>
        {activeVideoId && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[999] flex items-center justify-center p-4 md:p-8"
          >
            <div 
              className="absolute inset-0 bg-black/95 backdrop-blur-md" 
              onClick={() => setActiveVideoId(null)}
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-5xl aspect-video glass rounded-3xl overflow-hidden neon-border shadow-[0_0_100px_rgba(0,240,255,0.4)] z-10"
            >
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveVideoId(null);
                }}
                className="absolute top-4 right-4 z-20 p-3 bg-black/60 hover:bg-red-500 text-white rounded-full backdrop-blur-md transition-all shadow-xl"
              >
                <X size={24} />
              </button>
              <iframe 
                src={`https://www.youtube.com/embed/${activeVideoId}?autoplay=1&rel=0&modestbranding=1`}
                title="YouTube video player"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Article Generator Modal */}
      <AnimatePresence>
        {selectedVideoForArticle && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] flex items-center justify-center p-4 md:p-8"
          >
            <div 
              className="absolute inset-0 bg-black/95 backdrop-blur-md" 
              onClick={() => !isGeneratingArticle && setSelectedVideoForArticle(null)}
            />
            
            <motion.div 
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 50, opacity: 0 }}
              className="relative w-full max-w-6xl max-h-[90vh] glass rounded-[2.5rem] overflow-hidden neon-border flex flex-col"
            >
              {/* Modal Header */}
              <div className="p-6 md:p-8 border-b border-white/10 flex items-center justify-between bg-white/5">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-2xl bg-primary/20 text-primary">
                    <FileText size={24} />
                  </div>
                  <div>
                    <h2 className="font-display text-xl font-bold">Gerador de Artigo SEO</h2>
                    <p className="text-xs text-white/40 uppercase tracking-widest font-bold">Nexus Content Protocol</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedVideoForArticle(null)}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-grow overflow-y-auto p-6 md:p-10 custom-scrollbar">
                {isGeneratingArticle ? (
                  <div className="h-full flex flex-col items-center justify-center py-20 space-y-6">
                    <div className="relative">
                      <Loader2 size={64} className="text-primary animate-spin" />
                      <Sparkles size={24} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-secondary animate-pulse" />
                    </div>
                    <div className="text-center">
                      <h3 className="font-display text-2xl font-bold mb-2 animate-pulse">Processando Dados...</h3>
                      <p className="text-white/40 max-w-sm mx-auto">
                        Nossa IA está analisando o vídeo e criando um artigo otimizado com técnicas de SEO avançadas.
                      </p>
                    </div>
                  </div>
                ) : generationError ? (
                  <div className="h-full flex flex-col items-center justify-center py-20 space-y-6 text-center">
                    <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 mb-4">
                      <AlertCircle size={40} />
                    </div>
                    <h3 className="font-display text-xl font-bold text-red-500">Ops! Algo deu errado</h3>
                    <p className="text-white/60 max-w-md mx-auto text-sm">
                      {generationError}
                    </p>
                    <button 
                      onClick={() => generateSEOArticle(selectedVideoForArticle!)}
                      className="mt-4 px-6 py-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all text-xs font-bold uppercase tracking-widest"
                    >
                      Tentar Novamente
                    </button>
                  </div>
                ) : generatedArticle ? (
                  <div className="grid grid-cols-1 lg:grid-cols-[350px_1fr] gap-10">
                    {/* Sidebar: Image & Keywords */}
                    <div className="space-y-8">
                      <div className="space-y-4">
                        <label className="text-[10px] uppercase tracking-widest text-primary font-bold flex items-center gap-2">
                          <ImageIcon size={12} /> Imagem Principal
                        </label>
                        <div className="relative group rounded-2xl overflow-hidden border border-white/10 aspect-video">
                          <img 
                            src={customArticleImage || selectedVideoForArticle.thumbnail} 
                            alt="Cover" 
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                          <button 
                            onClick={() => setShowImageInput(!showImageInput)}
                            className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity gap-2 font-bold text-xs uppercase tracking-widest"
                          >
                            <Plus size={16} /> Alterar Imagem
                          </button>
                        </div>
                        
                        {showImageInput && (
                          <motion.div 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            className="space-y-2"
                          >
                            <input 
                              type="text" 
                              placeholder="URL da nova imagem..."
                              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs focus:outline-none focus:border-primary transition-all"
                              onBlur={(e) => {
                                if (e.target.value) setCustomArticleImage(e.target.value);
                                setShowImageInput(false);
                              }}
                              onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                  if ((e.target as HTMLInputElement).value) setCustomArticleImage((e.target as HTMLInputElement).value);
                                  setShowImageInput(false);
                                }
                              }}
                            />
                          </motion.div>
                        )}
                      </div>

                      <div className="space-y-4">
                        <label className="text-[10px] uppercase tracking-widest text-primary font-bold flex items-center gap-2">
                          <Search size={12} /> Palavras-Chave
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {generatedArticle.keywords.map((kw, i) => (
                            <span key={i} className="px-3 py-1 bg-white/5 border border-white/10 rounded-lg text-[10px] text-white/60">
                              {kw}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="p-6 rounded-2xl bg-primary/5 border border-primary/20 space-y-4">
                        <h4 className="text-xs font-bold uppercase tracking-widest text-primary">Dica de SEO</h4>
                        <p className="text-[11px] text-white/60 leading-relaxed">
                          Use a imagem principal com a tag ALT contendo a palavra-chave principal: <strong>{generatedArticle.keywords[0]}</strong>.
                        </p>
                      </div>
                    </div>

                    {/* Content Area */}
                    <div className="space-y-12">
                      {/* Summary Section */}
                      <section className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="font-display text-lg font-bold flex items-center gap-2">
                            <FileText size={18} className="text-secondary" /> Resumo da Transcrição
                          </h3>
                          <button 
                            onClick={() => copyToClipboard(generatedArticle.summary)}
                            className="p-2 hover:bg-white/10 rounded-lg text-white/40 hover:text-primary transition-all"
                            title="Copiar Resumo"
                          >
                            <Copy size={16} />
                          </button>
                        </div>
                        <div className="p-6 rounded-2xl bg-white/5 border border-white/10 text-sm text-white/70 leading-relaxed font-body italic">
                          {generatedArticle.summary}
                        </div>
                      </section>

                      {/* SEO Article Section */}
                      <section className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="font-display text-lg font-bold flex items-center gap-2">
                            <Sparkles size={18} className="text-accent" /> Artigo SEO Otimizado
                          </h3>
                          <div className="flex gap-2">
                            <span className="px-3 py-1 bg-accent/10 border border-accent/20 text-accent text-[9px] font-bold rounded-full flex items-center">
                              {typeof generatedArticle.seoArticle === 'string' ? generatedArticle.seoArticle.split(' ').length : 0} PALAVRAS
                            </span>
                            <button 
                              onClick={() => copyToClipboard(String(generatedArticle.seoArticle))}
                              className="flex items-center gap-2 px-4 py-2 bg-primary text-darker rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-accent transition-all"
                            >
                              <Copy size={14} /> Copiar Artigo
                            </button>
                          </div>
                        </div>
                        <div className="p-8 rounded-3xl bg-white/5 border border-white/10 text-sm text-white/80 leading-relaxed font-body whitespace-pre-wrap">
                          {String(generatedArticle.seoArticle)}
                        </div>
                      </section>
                    </div>
                  </div>
                ) : null}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast Notifications */}
      <div className="fixed bottom-8 right-8 z-50 flex flex-col gap-4">
        <AnimatePresence>
          {toasts.map(toast => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.9 }}
              className="glass p-5 rounded-2xl neon-border min-w-[300px] flex items-start gap-4 shadow-2xl"
            >
              <div className={`mt-1 p-2 rounded-full ${
                toast.type === 'success' ? 'bg-primary/20 text-primary' : 
                toast.type === 'error' ? 'bg-red-500/20 text-red-500' : 
                'bg-accent/20 text-accent'
              }`}>
                {toast.type === 'success' && <CheckCircle2 size={18} />}
                {toast.type === 'error' && <AlertCircle size={18} />}
                {toast.type === 'warning' && <Info size={18} />}
              </div>
              <div>
                <h4 className="font-display text-xs font-bold uppercase tracking-wider mb-1">{toast.title}</h4>
                <p className="text-xs text-white/60">{toast.message}</p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <footer className="mt-20 py-10 border-t border-white/5 text-center">
        <p className="text-[10px] uppercase tracking-[0.3em] text-white/20 font-bold">
          Nexus Protocol &copy; {new Date().getFullYear()} // All Rights Reserved
        </p>
      </footer>
    </div>
  );
}
