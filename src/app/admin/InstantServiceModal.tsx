import React, { useState, useEffect } from 'react';
import { Zap, Search, User, Book as BookIcon, Plus, Trash2, CheckCircle2, AlertCircle, Loader2, X, RotateCcw, Printer } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Card } from '../../components/ui/Card.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { BorrowTicket } from '../../components/BorrowTicket.tsx';
import { cn } from '../../utils/cn.ts';

interface InstantServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  books: any[];
}

export const InstantServiceModal = ({ isOpen, onClose, books }: InstantServiceModalProps) => {
  const [step, setStep] = useState<'user' | 'books' | 'confirm'>('user');
  const [userSearch, setUserSearch] = useState('');
  const [bookSearch, setBookSearch] = useState('');
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [selectedBooks, setSelectedBooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [tickets, setTickets] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      Promise.all([
        fetch('/api/admin/users?verified=true').then(res => res.json()).catch(() => []),
        fetch('/api/admin/student-verifications').then(res => res.json()).catch(() => []),
      ]).then(([usersResp, verificationsResp]) => {
        const list = Array.isArray(usersResp) ? usersResp : usersResp?.data ?? [];
        const verifications = Array.isArray(verificationsResp) ? verificationsResp : [];
        const approvedIds = new Set(
          verifications
            .filter((v: any) => String(v.status || '').toLowerCase() === 'approved')
            .map((v: any) => v.clerkId)
        );
        const filtered = list.filter((u: any) => approvedIds.size === 0
          ? (u.role || '').toLowerCase() === 'student'
          : approvedIds.has(u.clerkId)
        );
        setAllUsers(filtered);
      });
      // Reset state
      setStep('user');
      setSelectedUser(null);
      setSelectedBooks([]);
      setTickets([]);
      setError(null);
    }
  }, [isOpen]);

  const filteredUsers = allUsers.filter(u =>
    u.primaryEmail.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.clerkId.toLowerCase().includes(userSearch.toLowerCase()) ||
    (u.fullName || '').toLowerCase().includes(userSearch.toLowerCase())
  );

  const safeBooks = Array.isArray(books) ? books : [];
  const filteredBooks = safeBooks.filter(b => 
    !b.isDigital && 
    b.availableCopies > 0 &&
    (b.title.toLowerCase().includes(bookSearch.toLowerCase()) || 
     b.author.toLowerCase().includes(bookSearch.toLowerCase()) ||
     b.isbn.toLowerCase().includes(bookSearch.toLowerCase()))
  );

  const handleSelectUser = (user: any) => {
    setSelectedUser(user);
    setStep('books');
  };

  const toggleBook = (book: any) => {
    if (selectedBooks.find(b => b.id === book.id)) {
      setSelectedBooks(selectedBooks.filter(b => b.id !== book.id));
    } else {
      setSelectedBooks([...selectedBooks, book]);
    }
  };

  const handleBorrow = async () => {
    if (!selectedUser || selectedBooks.length === 0) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const res = await fetch('/api/transactions/borrow-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-is-admin': 'true' },
        body: JSON.stringify({ 
          bookIds: selectedBooks.map(b => b.id), 
          userId: selectedUser.clerkId
        })
      });
      
      const data = await res.json();
      if (res.ok && data.success) {
        setTickets(data.results);
      } else {
        setError(data.errors?.[0]?.error || "Falha ao processar a transacao.");
      }
    } catch (err) {
      setError("Falha ao processar a transacao.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;




  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
        <motion.div 
          initial={{ scale: 0.95, opacity: 0, y: 20 }} 
          animate={{ scale: 1, opacity: 1, y: 0 }}
          className="w-full max-w-5xl max-h-[90vh] flex flex-col"
        >
          <Card className="flex-grow flex flex-col overflow-hidden shadow-2xl border-none">
            {/* Header */}
            <div className="p-6 bg-lime-600 text-white flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <Zap className="w-6 h-6 fill-yellow-400 text-yellow-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold leading-tight">Balcao de circulacao</h2>
                  <p className="text-lime-100 text-xs uppercase tracking-widest font-bold">Ponto de servico imediato</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Progress Bar */}
            <div className="bg-lime-700 h-1 w-full flex">
              <div className={cn("h-full bg-yellow-400 transition-all duration-500", 
                step === 'user' ? "w-1/3" : step === 'books' ? "w-2/3" : "w-full"
              )} />
            </div>

            <div className="flex flex-grow overflow-hidden">
              {/* Left Panel: Search & Selection */}
              <div className="flex-grow p-8 overflow-y-auto border-r border-gray-100 bg-white">
                <AnimatePresence mode="wait">
                  {step === 'user' && (
                    <motion.div 
                      key="user-step"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="space-y-6"
                    >
                      <div>
                        <h3 className="text-2xl font-bold mb-2">Identificar utilizador</h3>
                        <p className="text-gray-500 mb-6">Procure um estudante verificado para requisicao imediata.</p>
                        <div className="relative">
                          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                          <input 
                            autoFocus
                            className="w-full pl-12 pr-4 py-4 border-2 border-gray-100 rounded-2xl focus:border-lime-500 outline-none transition-all text-lg"
                            placeholder="Pesquisar por email ou ID..."
                            value={userSearch}
                            onChange={e => setUserSearch(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="space-y-3">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Estudantes verificados</p>
                        <div className="space-y-2">
                          {filteredUsers.slice(0, 6).map(u => (
                            <button 
                              key={u.clerkId}
                              onClick={() => handleSelectUser(u)}
                              className="w-full p-4 border border-gray-100 rounded-xl hover:bg-gray-50 hover:border-lime-200 transition-all flex items-center justify-between group"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-lime-100 rounded-full flex items-center justify-center text-lime-600 font-bold">
                                  {(u.fullName || u.primaryEmail)[0].toUpperCase()}
                                </div>
                                <div className="text-left">
                                  <p className="text-sm font-bold">{u.fullName || u.primaryEmail}</p>
                                  <p className="text-[10px] text-gray-400">{u.primaryEmail}</p>
                                </div>
                              </div>
                              <CheckCircle2 className="w-5 h-5 text-transparent group-hover:text-lime-500" />
                            </button>
                          ))}
                          {filteredUsers.length === 0 && <p className="text-sm text-gray-400 italic p-4">Nao foram encontrados estudantes verificados com essa pesquisa.</p>}
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {step === 'books' && (
                    <motion.div 
                      key="books-step"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="space-y-6"
                    >
                      <div>
                        <div className="flex justify-between items-end mb-4">
                          <div>
                            <h3 className="text-2xl font-bold">Selecionar livros</h3>
                            <p className="text-gray-500">Leia o ISBN ou pesquise exemplares fisicos disponiveis em stock.</p>
                          </div>
                          <button onClick={() => setStep('user')} className="text-sm text-lime-600 font-bold hover:underline mb-1">Alterar utilizador</button>
                        </div>
                        <div className="relative">
                          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                          <input 
                            autoFocus
                            className="w-full pl-12 pr-4 py-4 border-2 border-gray-100 rounded-2xl focus:border-lime-500 outline-none transition-all text-lg"
                            placeholder="Pesquisar por titulo, autor ou ISBN..."
                            value={bookSearch}
                            onChange={e => setBookSearch(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {filteredBooks.slice(0, 10).map(b => {
                          const isSelected = selectedBooks.find(sb => sb.id === b.id);
                          return (
                            <button 
                              key={b.id}
                              onClick={() => toggleBook(b)}
                              className={cn(
                                "w-full p-4 border-2 rounded-2xl transition-all flex items-center gap-4 group text-left relative overflow-hidden",
                                isSelected ? "border-lime-500 bg-lime-50/50" : "border-gray-50 hover:border-gray-200 hover:bg-gray-50"
                              )}
                            >
                              <div className="relative shrink-0">
                                <img src={b.cover} className="w-12 h-16 object-cover rounded-lg shadow-md" alt="" referrerPolicy="no-referrer" />
                                {isSelected && (
                                  <div className="absolute -top-2 -right-2 bg-lime-600 text-white rounded-full p-1 shadow-lg">
                                    <CheckCircle2 className="w-4 h-4" />
                                  </div>
                                )}
                              </div>
                              <div className="overflow-hidden">
                                <p className="text-sm font-bold truncate">{b.title}</p>
                                <p className="text-xs text-gray-500 truncate">{b.author}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-[10px] font-mono text-gray-400 bg-white px-1.5 py-0.5 rounded border border-gray-100">{b.isbn}</span>
                                  <span className="text-[10px] font-bold text-emerald-600">{b.availableCopies} restantes</span>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                        {filteredBooks.length === 0 && <p className="text-sm text-gray-400 italic p-8 text-center col-span-full">Nao foram encontrados livros disponiveis para a sua pesquisa.</p>}
                      </div>
                    </motion.div>
                  )}

                  {step === 'confirm' && (
                    <motion.div 
                      key="confirm-step"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="space-y-8 py-4"
                    >
                      <div className="text-center space-y-2">
                        <div className="w-20 h-20 bg-lime-100 rounded-full flex items-center justify-center text-lime-600 mx-auto mb-4">
                          <Zap className="w-10 h-10 fill-lime-600" />
                        </div>
                        <h3 className="text-3xl font-black">Confirmacao final</h3>
                        <p className="text-gray-500">Verifique os detalhes da requisicao antes de continuar.</p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Informacao do cliente</p>
                          <div className="p-6 bg-gray-50 rounded-3xl border border-gray-100 flex items-center gap-4">
                            <div className="w-16 h-16 bg-lime-600 rounded-2xl flex items-center justify-center text-white text-2xl font-black shadow-xl shadow-lime-200">
                              {(selectedUser?.fullName || selectedUser?.primaryEmail || '?')[0].toUpperCase()}
                            </div>
                            <div className="overflow-hidden">
                              <p className="text-xl font-bold truncate">{selectedUser?.fullName || selectedUser?.primaryEmail}</p>
                              <p className="text-xs text-gray-400 truncate">{selectedUser?.primaryEmail}</p>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Itens a requisitar ({selectedBooks.length})</p>
                          <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                            {selectedBooks.map(b => (
                              <div key={b.id} className="p-3 bg-white border border-gray-100 rounded-xl flex items-center gap-3 shadow-sm">
                                <img src={b.cover} className="w-8 h-10 object-cover rounded shadow-sm" alt="" referrerPolicy="no-referrer" />
                                <div className="overflow-hidden flex-grow">
                                  <p className="text-sm font-bold truncate">{b.title}</p>
                                  <p className="text-[10px] text-gray-400 font-mono">{b.isbn}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Right Panel: Summary & Action */}
              <div className="w-96 bg-gray-50 p-8 flex flex-col">
                <h3 className="text-xs font-bold text-gray-400 uppercase mb-6 tracking-widest">Resumo da transacao</h3>
                
                <div className="flex-grow space-y-8">
                  {/* User Summary Widget */}
                  <div className={cn(
                    "p-5 rounded-3xl transition-all duration-300",
                    selectedUser ? "bg-white shadow-xl shadow-gray-200/50 border border-lime-100" : "bg-gray-100 border border-dashed border-gray-200"
                  )}>
                    <p className="text-[10px] font-bold text-gray-400 uppercase mb-3">Membro</p>
                    {selectedUser ? (
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-lime-600 rounded-2xl flex items-center justify-center text-white font-black shadow-lg shadow-lime-200">
                          {(selectedUser.fullName || selectedUser.primaryEmail)[0].toUpperCase()}
                        </div>
                        <div className="overflow-hidden">
                          <p className="text-sm font-bold truncate">{selectedUser.fullName || selectedUser.primaryEmail}</p>
                          <p className="text-[10px] text-gray-400 truncate">{selectedUser.primaryEmail}</p>
                        </div>
                        <button onClick={() => setStep('user')} className="ml-auto p-2 text-gray-300 hover:text-lime-600 transition-colors">
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 text-gray-400 py-2">
                        <User className="w-5 h-5 opacity-50" />
                        <p className="text-sm italic">Selecao pendente...</p>
                      </div>
                    )}
                  </div>

                  {/* Books Summary Widget */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Itens selecionados</p>
                      <span className="bg-lime-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full">{selectedBooks.length}</span>
                    </div>
                    
                    <div className="space-y-2 max-h-72 overflow-y-auto pr-2 custom-scrollbar">
                      {selectedBooks.map(b => (
                        <motion.div 
                          layout
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          key={b.id} 
                          className="p-3 bg-white rounded-2xl border border-gray-100 flex items-center justify-between group shadow-sm hover:shadow-md transition-all"
                        >
                          <div className="flex items-center gap-3 overflow-hidden">
                            <img src={b.cover} className="w-8 h-12 object-cover rounded-lg shadow-sm" alt="" referrerPolicy="no-referrer" />
                            <div className="overflow-hidden">
                              <p className="text-xs font-bold truncate">{b.title}</p>
                              <p className="text-[9px] text-gray-400 truncate">{b.author}</p>
                            </div>
                          </div>
                          <button 
                            onClick={() => toggleBook(b)} 
                            className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </motion.div>
                      ))}
                      {selectedBooks.length === 0 && (
                        <div className="p-10 border-2 border-dashed border-gray-200 rounded-3xl flex flex-col items-center justify-center text-center bg-gray-50/50">
                          <BookIcon className="w-10 h-10 text-gray-200 mb-3" />
                          <p className="text-xs text-gray-400 leading-relaxed">Ainda nao foram adicionados livros a<br/>transacao.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Footer Action */}
                <div className="pt-8 border-t border-gray-200 space-y-4">
                  {error && (
                    <div className="p-4 bg-red-50 text-red-600 rounded-2xl text-xs flex items-start gap-3 animate-shake border border-red-100">
                      <AlertCircle className="w-5 h-5 shrink-0" />
                      <p className="font-medium leading-relaxed">{error}</p>
                    </div>
                  )}
                  
                  {step === 'confirm' ? (
                    <div className="flex gap-3">
                      <Button 
                        variant="secondary"
                        className="flex-1 py-6 rounded-2xl"
                        onClick={() => setStep('books')}
                        disabled={loading}
                      >
                        Voltar
                      </Button>
                      <Button 
                        className="flex-[2] py-6 text-lg font-black rounded-2xl shadow-xl shadow-lime-200 bg-lime-600 hover:bg-lime-700"
                        disabled={loading}
                        onClick={handleBorrow}
                      >
                        {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : "Confirmar e concluir"}
                      </Button>
                    </div>
                  ) : (
                    <Button 
                      className="w-full py-6 text-lg font-black rounded-2xl shadow-xl shadow-lime-200 bg-lime-600 hover:bg-lime-700 disabled:bg-gray-200 disabled:shadow-none transition-all"
                      disabled={!selectedUser || selectedBooks.length === 0}
                      onClick={() => setStep('confirm')}
                    >
                      Continuar para requisicao
                    </Button>
                  )}
                  
                  <p className="text-[10px] text-center text-gray-400 font-medium">
                    {step === 'confirm' ? "Passo final: rever e confirmar" : "Selecione utilizador e livros para continuar"}
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>

      <AnimatePresence>
        {tickets.length > 0 && (
          <div className="fixed inset-0 z-[60] overflow-y-auto bg-black/90 backdrop-blur-xl p-8 flex flex-col items-center gap-8">
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="w-full max-w-2xl flex justify-between items-center text-white"
            >
              <div>
                <h2 className="text-3xl font-black">Requisicao concluida com sucesso</h2>
                <p className="text-lime-300 text-sm font-medium">Todos os itens foram processados com sucesso.</p>
              </div>
              <button 
                onClick={() => {
                  setTickets([]);
                  onClose();
                }}
                className="p-3 bg-white/10 hover:bg-white/20 rounded-2xl transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </motion.div>

            <div className="flex flex-wrap justify-center gap-8 pb-32">
              {tickets.map((t, idx) => (
                <motion.div 
                  key={idx} 
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: idx * 0.1 }}
                  className="print:break-after-page"
                >
                  <BorrowTicket 
                    activity={t} 
                    onClose={() => {
                      const newTickets = [...tickets];
                      newTickets.splice(idx, 1);
                      setTickets(newTickets);
                      if (newTickets.length === 0) onClose();
                    }} 
                  />
                </motion.div>
              ))}
            </div>

            <div className="fixed bottom-12 left-1/2 -translate-x-1/2 print:hidden z-50">
              <Button 
                className="px-16 py-6 rounded-3xl shadow-2xl bg-white text-lime-600 hover:bg-gray-100 font-black text-xl flex items-center gap-3 transition-all hover:scale-105 active:scale-95"
                onClick={() => window.print()}
              >
                <Printer className="w-6 h-6" />
                Imprimir todos os taloes
              </Button>
            </div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
