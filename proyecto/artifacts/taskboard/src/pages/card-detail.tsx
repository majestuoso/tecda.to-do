import { useGetCard, useUpdateCard, useDeleteCard, getGetCardQueryKey, useListBoardMembers } from "@workspace/api-client-react";
import { useParams, useLocation } from "wouter";
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Clock, Paperclip, Link as LinkIcon, Trash2, AlignLeft, Calendar as CalendarIcon, User, Plus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

export function CardDetail() {
  const params = useParams();
  const boardId = Number(params.boardId);
  const cardId = Number(params.cardId);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  
  const { data: card, isLoading } = useGetCard(cardId, {
    query: { enabled: !!cardId, queryKey: getGetCardQueryKey(cardId) }
  });
  
  const { data: members } = useListBoardMembers(boardId, {
    query: { enabled: !!boardId }
  });

  const updateCard = useUpdateCard();
  const deleteCard = useDeleteCard();
  
  const [desc, setDesc] = useState("");
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (card) setDesc(card.description || "");
  }, [card]);

  const handleUpdate = (updates: any) => {
    updateCard.mutate({
      cardId,
      data: updates
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCardQueryKey(cardId) });
      }
    });
  };

  const handleDescSave = () => {
    handleUpdate({ description: desc });
    setIsEditingDesc(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`/api/cards/${cardId}/attachments`, {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: getGetCardQueryKey(cardId) });
      }
    } catch (err) {
      console.error("Upload failed", err);
    }
  };

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this card?")) {
      deleteCard.mutate({ cardId }, {
        onSuccess: () => {
          setLocation(`/boards/${boardId}`);
        }
      });
    }
  };

  if (isLoading) return <div className="p-8">Loading card...</div>;
  if (!card) return <div className="p-8">Card not found</div>;

  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-hidden animate-in fade-in">
      <header className="px-6 py-4 border-b flex items-center justify-between bg-card shrink-0">
        <Button variant="ghost" onClick={() => setLocation(`/boards/${boardId}`)} className="-ml-2">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Board
        </Button>
        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={handleDelete}>
          <Trash2 className="w-4 h-4" />
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto p-6 lg:p-10">
        <div className="max-w-4xl mx-auto space-y-10">
          
          {/* Title & Meta */}
          <div className="space-y-6">
            <h1 className="text-3xl lg:text-4xl font-bold tracking-tight">
              {card.title}
            </h1>
            
            <div className="flex flex-wrap gap-6 items-center">
              {/* Status */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</label>
                <Select 
                  value={card.status} 
                  onValueChange={(val: any) => handleUpdate({ status: val })}
                >
                  <SelectTrigger className="w-40 h-9 font-medium">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todo">To Do</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="done">Done</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Assignee */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Assignee</label>
                <Select 
                  value={card.assigneeId || "unassigned"} 
                  onValueChange={(val) => handleUpdate({ assigneeId: val === "unassigned" ? null : val })}
                >
                  <SelectTrigger className="w-48 h-9 font-medium">
                    <div className="flex items-center gap-2">
                      {card.assigneeId ? (
                        <>
                          <Avatar className="w-5 h-5">
                            <AvatarImage src={card.assigneeImage || ""} />
                            <AvatarFallback>{card.assigneeUsername?.[0] || "U"}</AvatarFallback>
                          </Avatar>
                          <span className="truncate">{card.assigneeUsername}</span>
                        </>
                      ) : (
                        <>
                          <User className="w-4 h-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Unassigned</span>
                        </>
                      )}
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {members?.map(m => (
                      <SelectItem key={m.userId} value={m.userId}>
                        <div className="flex items-center gap-2">
                          <Avatar className="w-5 h-5">
                            <AvatarImage src={m.profileImage || ""} />
                            <AvatarFallback>{m.username?.[0]}</AvatarFallback>
                          </Avatar>
                          {m.username}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Due Date */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Due Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={`h-9 w-40 justify-start font-medium ${!card.dueDate && "text-muted-foreground"}`}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {card.dueDate ? new Date(card.dueDate).toLocaleDateString() : "Set due date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={card.dueDate ? new Date(card.dueDate) : undefined}
                      onSelect={(date) => {
                        handleUpdate({ dueDate: date ? date.toISOString() : null });
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-lg font-semibold">
              <AlignLeft className="w-5 h-5" /> Description
            </div>
            
            {isEditingDesc ? (
              <div className="space-y-3">
                <Textarea 
                  value={desc} 
                  onChange={e => setDesc(e.target.value)} 
                  className="min-h-[150px] resize-y"
                  placeholder="Add a more detailed description..."
                />
                <div className="flex gap-2">
                  <Button onClick={handleDescSave}>Save</Button>
                  <Button variant="ghost" onClick={() => {
                    setDesc(card.description || "");
                    setIsEditingDesc(false);
                  }}>Cancel</Button>
                </div>
              </div>
            ) : (
              <div 
                className="bg-muted/30 hover:bg-muted/50 transition-colors p-4 rounded-xl min-h-[100px] cursor-pointer whitespace-pre-wrap text-sm border border-transparent hover:border-border"
                onClick={() => setIsEditingDesc(true)}
              >
                {card.description || <span className="text-muted-foreground italic">Add a more detailed description...</span>}
              </div>
            )}
          </div>

          {/* Attachments */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-lg font-semibold">
                <Paperclip className="w-5 h-5" /> Attachments
              </div>
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                <Plus className="w-4 h-4 mr-2" /> Add Attachment
              </Button>
              <input type="file" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {card.attachments?.map(att => (
                <a 
                  key={att.id} 
                  href={att.url} 
                  target="_blank" 
                  rel="noreferrer"
                  className="flex items-center gap-3 p-3 rounded-lg border hover-elevate bg-card group"
                >
                  <div className="w-10 h-10 bg-primary/10 text-primary rounded flex items-center justify-center shrink-0">
                    <LinkIcon className="w-5 h-5" />
                  </div>
                  <div className="overflow-hidden flex-1">
                    <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{att.originalName}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(att.createdAt).toLocaleDateString()} • {(att.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </a>
              ))}
              {(!card.attachments || card.attachments.length === 0) && (
                <div className="col-span-full py-8 text-center text-sm text-muted-foreground bg-muted/20 rounded-xl border border-dashed">
                  No attachments yet.
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
