'use client';
import { useState, type ChangeEvent, useEffect, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  adminUploadsPdfKnowledgeBase,
  getKnowledgeDocuments,
  deleteKnowledgeDocument,
  extractDocumentContent,
  type KnowledgeDocument,
} from '@/ai/flows/admin-uploads-pdf-knowledge-base';
import { UploadCloud, Loader2, FileText, X, Files, Trash2, RefreshCw, CheckCircle2, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const BATCH_SIZE = 10;
const FILE_TIMEOUT_MS = 15_000; // 15 seconds per file (local parsing is near-instant)

type SkippedFile = {
  fileName: string;
  reason: string;
};

type RebuildProgress = {
  total: number;
  processed: number;
  skipped: number;
  currentBatch: string[];
  skippedFiles: SkippedFile[];
  done: boolean;
};

export default function KnowledgeBasePage() {
    const [files, setFiles] = useState<File[]>([]);
    const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isFetchingDocs, setIsFetchingDocs] = useState(true);
    const [isRebuilding, setIsRebuilding] = useState(false);
    const [rebuildProgress, setRebuildProgress] = useState<RebuildProgress | null>(null);
    const [showSkipped, setShowSkipped] = useState(false);
    const { toast } = useToast();
    const abortRebuild = useRef(false);

    const fetchDocuments = async () => {
        setIsFetchingDocs(true);
        try {
            const docs = await getKnowledgeDocuments();
            setDocuments(docs);
        } catch (error) {
            console.error("Error fetching knowledge documents:", error);
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Could not fetch knowledge documents.',
            });
        } finally {
            setIsFetchingDocs(false);
        }
    };

    useEffect(() => {
        fetchDocuments();
    }, []);

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setFiles(Array.from(e.target.files));
        }
    };

    const handleUpload = async () => {
        if (files.length === 0) {
            toast({
                variant: 'destructive',
                title: 'No files selected',
                description: 'Please choose one or more PDF files to upload.',
            });
            return;
        }

        setIsLoading(true);

        try {
            const filePromises = files.map(file => {
                return new Promise<{ pdfDataUri: string; fileName: string }>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.readAsDataURL(file);
                    reader.onload = () => resolve({
                        pdfDataUri: reader.result as string,
                        fileName: file.name
                    });
                    reader.onerror = (error) => reject(error);
                });
            });

            const documentsToUpload = await Promise.all(filePromises);
            const result = await adminUploadsPdfKnowledgeBase({ documents: documentsToUpload });

            if (result.success) {
                toast({
                    title: 'Upload Complete',
                    description: result.message,
                });
                setFiles([]);
                fetchDocuments();
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Upload Failed',
                description: (error as Error).message || 'An unknown error occurred during upload.',
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (docId: string, docName: string) => {
        setIsLoading(true);
        try {
            const result = await deleteKnowledgeDocument(docId);
            if (result.success) {
                toast({
                    title: 'Document Deleted',
                    description: `'${docName}' has been removed from the knowledge base.`,
                });
                fetchDocuments();
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Deletion Failed',
                description: (error as Error).message,
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleRebuild = async () => {
        const docs = await getKnowledgeDocuments();
        if (docs.length === 0) {
            toast({ title: 'Nothing to rebuild', description: 'No documents found in the knowledge base.' });
            return;
        }

        abortRebuild.current = false;
        setIsRebuilding(true);
        setShowSkipped(false);
        setRebuildProgress({
            total: docs.length,
            processed: 0,
            skipped: 0,
            currentBatch: [],
            skippedFiles: [] as SkippedFile[],
            done: false,
        });

        for (let i = 0; i < docs.length; i += BATCH_SIZE) {
            if (abortRebuild.current) break;

            const batch = docs.slice(i, i + BATCH_SIZE);
            const batchNames = batch.map(d => d.fileName);

            setRebuildProgress(prev => prev ? { ...prev, currentBatch: batchNames } : prev);

            await Promise.all(batch.map(async (doc) => {
                try {
                    const timeoutPromise = new Promise<never>((_, reject) =>
                        setTimeout(() => reject(new Error('timeout')), FILE_TIMEOUT_MS)
                    );

                    const result = await Promise.race([
                        extractDocumentContent(doc.id),
                        timeoutPromise,
                    ]);

                    if (result.success) {
                        setRebuildProgress(prev => prev
                            ? { ...prev, processed: prev.processed + 1 }
                            : prev
                        );
                    } else {
                        setRebuildProgress(prev => prev ? {
                            ...prev,
                            skipped: prev.skipped + 1,
                            skippedFiles: [...prev.skippedFiles, { fileName: doc.fileName, reason: result.error || 'Unknown error' }],
                        } : prev);
                    }
                } catch (e: any) {
                    const reason = e?.message === 'timeout' ? `Timed out after ${FILE_TIMEOUT_MS / 1000}s` : (e?.message || 'Unknown error');
                    setRebuildProgress(prev => prev ? {
                        ...prev,
                        skipped: prev.skipped + 1,
                        skippedFiles: [...prev.skippedFiles, { fileName: doc.fileName, reason }],
                    } : prev);
                }
            }));
        }

        setRebuildProgress(prev => prev ? { ...prev, done: true, currentBatch: [] } : prev);
        setIsRebuilding(false);
        fetchDocuments();

        setRebuildProgress(prev => {
            if (!prev) return prev;
            toast({
                title: prev.skipped === 0 ? 'Rebuild Complete' : 'Rebuild Complete (with skips)',
                description: `${prev.processed} file${prev.processed !== 1 ? 's' : ''} extracted successfully.${prev.skipped > 0 ? ` ${prev.skipped} skipped (timed out or failed).` : ''}`,
                variant: prev.skipped > 0 ? 'destructive' : 'default',
            });
            return prev;
        });
    };

    const progressPercent = rebuildProgress
        ? Math.round(((rebuildProgress.processed + rebuildProgress.skipped) / rebuildProgress.total) * 100)
        : 0;

    return (
        <div className="grid gap-6 md:grid-cols-2">
            <div className="flex flex-col gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Upload Knowledge</CardTitle>
                        <CardDescription>Upload PDF documents to train the chatbot. Content is extracted immediately after upload.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex flex-col items-center justify-center w-full">
                            <label htmlFor="pdf-upload" className="relative flex flex-col items-center justify-center w-full h-52 border-2 border-dashed rounded-lg cursor-pointer bg-card hover:bg-accent/50 transition-colors">
                                {files.length > 0 ? (
                                    <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center">
                                        <Files className="w-10 h-10 mb-3 text-primary" />
                                        <p className="mb-2 text-sm text-foreground"><span className="font-semibold">{files.length} file{files.length > 1 ? 's' : ''} selected</span></p>
                                        <ul className="text-xs text-muted-foreground list-disc list-inside max-h-24 overflow-y-auto">
                                            {files.map(f => <li key={f.name} className="truncate">{f.name}</li>)}
                                        </ul>
                                        <Button variant="ghost" size="icon" className="absolute top-2 right-2 rounded-full h-7 w-7 z-10" onClick={(e) => { e.preventDefault(); setFiles([]); }}>
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                        <UploadCloud className="w-10 h-10 mb-3 text-muted-foreground" />
                                        <p className="mb-2 text-sm text-muted-foreground"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                                        <p className="text-xs text-muted-foreground">PDFs (MAX. 5MB each)</p>
                                    </div>
                                )}
                                <Input id="pdf-upload" type="file" className="hidden" onChange={handleFileChange} accept=".pdf" disabled={isLoading} multiple />
                            </label>
                        </div>

                        <Button onClick={handleUpload} disabled={files.length === 0 || isLoading} className="w-full">
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Uploading {files.length} file{files.length > 1 ? 's' : ''}...
                                </>
                            ) : (
                                `Upload and Process ${files.length || ''} File${files.length !== 1 ? 's' : ''}`.trim()
                            )}
                        </Button>
                    </CardContent>
                    <CardFooter className="flex flex-col gap-4 border-t pt-6">
                        <div className="w-full">
                            <h3 className="text-sm font-semibold mb-2">Advanced Options</h3>
                            <p className="text-xs text-muted-foreground mb-4">
                                Re-extract text from all documents. Processed in parallel batches of {BATCH_SIZE}, up to {FILE_TIMEOUT_MS / 60000} minutes per file.
                            </p>
                            <Button
                                onClick={handleRebuild}
                                disabled={isRebuilding || isLoading}
                                variant="outline"
                                className="w-full"
                            >
                                {isRebuilding ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Rebuilding...
                                    </>
                                ) : (
                                    <>
                                        <RefreshCw className="mr-2 h-4 w-4" />
                                        Rebuild Knowledge Base
                                    </>
                                )}
                            </Button>
                        </div>
                    </CardFooter>
                </Card>

                {/* Progress Card */}
                {rebuildProgress && (
                    <Card className="border-primary/30">
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-base">
                                    {rebuildProgress.done ? (
                                        <span className="flex items-center gap-2">
                                            {rebuildProgress.skipped === 0
                                                ? <CheckCircle2 className="h-5 w-5 text-green-500" />
                                                : <AlertTriangle className="h-5 w-5 text-amber-500" />
                                            }
                                            Rebuild {rebuildProgress.skipped === 0 ? 'Complete' : 'Finished'}
                                        </span>
                                    ) : (
                                        <span className="flex items-center gap-2">
                                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                            Rebuilding Knowledge Base
                                        </span>
                                    )}
                                </CardTitle>
                                <span className="text-sm text-muted-foreground font-mono">
                                    {rebuildProgress.processed + rebuildProgress.skipped}/{rebuildProgress.total}
                                </span>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {/* Progress bar */}
                            <div className="w-full bg-muted rounded-full h-2.5">
                                <div
                                    className="h-2.5 rounded-full transition-all duration-300"
                                    style={{
                                        width: `${progressPercent}%`,
                                        backgroundColor: rebuildProgress.done && rebuildProgress.skipped > 0
                                            ? 'rgb(245 158 11)'
                                            : 'hsl(var(--primary))',
                                    }}
                                />
                            </div>

                            {/* Counts */}
                            <div className="flex gap-4 text-xs">
                                <span className="flex items-center gap-1 text-green-600 font-medium">
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    {rebuildProgress.processed} extracted
                                </span>
                                {rebuildProgress.skipped > 0 && (
                                    <span className="flex items-center gap-1 text-amber-600 font-medium">
                                        <AlertTriangle className="h-3.5 w-3.5" />
                                        {rebuildProgress.skipped} skipped
                                    </span>
                                )}
                            </div>

                            {/* Current batch */}
                            {!rebuildProgress.done && rebuildProgress.currentBatch.length > 0 && (
                                <div className="space-y-1">
                                    <p className="text-xs text-muted-foreground font-medium">Currently processing:</p>
                                    <ul className="space-y-0.5">
                                        {rebuildProgress.currentBatch.map(name => (
                                            <li key={name} className="text-xs text-muted-foreground flex items-center gap-1.5 truncate">
                                                <Loader2 className="h-3 w-3 animate-spin shrink-0" />
                                                {name}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Skipped files accordion */}
                            {rebuildProgress.done && rebuildProgress.skippedFiles.length > 0 && (
                                <div className="border rounded-md overflow-hidden">
                                    <button
                                        onClick={() => setShowSkipped(v => !v)}
                                        className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors"
                                    >
                                        <span>{rebuildProgress.skippedFiles.length} files timed out or failed</span>
                                        {showSkipped ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                                    </button>
                                    {showSkipped && (
                                        <ul className="px-3 py-2 space-y-1.5 bg-card">
                                            {rebuildProgress.skippedFiles.map(f => (
                                                <li key={f.fileName} className="text-xs">
                                                    <span className="text-foreground font-medium truncate block">{f.fileName}</span>
                                                    <span className="text-muted-foreground">{f.reason}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Current Knowledge Base</CardTitle>
                    <CardDescription>The following documents are currently part of the chatbot's knowledge.</CardDescription>
                </CardHeader>
                <CardContent>
                    <ScrollArea className="h-[27rem] pr-4">
                        {isFetchingDocs ? (
                            <div className="flex items-center justify-center h-full">
                                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                            </div>
                        ) : documents.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground p-8 border-2 border-dashed rounded-lg">
                                <FileText className="w-12 h-12 mb-4" />
                                <h3 className="font-semibold text-lg">No Documents Found</h3>
                                <p className="text-sm">Upload a PDF to get started.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {documents.map(doc => (
                                    <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg bg-accent/50">
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <div className="relative shrink-0">
                                                <FileText className="h-5 w-5 text-primary" />
                                                {doc.extractedContent ? (
                                                    <CheckCircle2 className="h-3 w-3 text-green-500 absolute -bottom-1 -right-1 bg-background rounded-full" />
                                                ) : (
                                                    <AlertTriangle className="h-3 w-3 text-amber-500 absolute -bottom-1 -right-1 bg-background rounded-full" />
                                                )}
                                            </div>
                                            <div className="flex-grow overflow-hidden">
                                                <p className="text-sm font-medium text-foreground truncate" title={doc.fileName}>{doc.fileName}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    Added: {doc.uploadedAt ? new Date(doc.uploadedAt.seconds * 1000).toLocaleDateString() : 'N/A'}
                                                    {doc.extractedContent
                                                        ? ` · ${Math.round(doc.extractedContent.length / 1024)}KB extracted`
                                                        : ' · not extracted'}
                                                </p>
                                            </div>
                                        </div>

                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" disabled={isLoading}>
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        This will permanently delete <span className="font-semibold text-foreground">"{doc.fileName}"</span> from the knowledge base. This action cannot be undone.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleDelete(doc.id, doc.fileName)} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                                                        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                                        Delete
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </div>
                                ))}
                            </div>
                        )}
                    </ScrollArea>
                </CardContent>
            </Card>
        </div>
    );
}
