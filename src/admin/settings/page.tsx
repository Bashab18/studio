'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { updateChatbotPersona, getChatbotPersona, updateChatbotModel, getChatbotModel } from '@/ai/flows/admin-manages-settings';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const models = [
    { id: 'gemini-1.5-flash-latest', name: 'Gemini 1.5 Flash' },
    { id: 'gemini-1.5-pro-latest', name: 'Gemini 1.5 Pro' },
    { id: 'gemma-7b-it', name: 'Gemma 7B' },
];

export default function SettingsPage() {
  const [persona, setPersona] = useState('');
  const [model, setModel] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    async function fetchSettings() {
      setIsLoading(true);
      try {
        const [personaResult, modelResult] = await Promise.all([
            getChatbotPersona(),
            getChatbotModel()
        ]);
        
        if (personaResult.persona !== undefined) {
          setPersona(personaResult.persona);
        } else {
           toast({
            variant: 'destructive',
            title: 'Error',
            description: 'Could not fetch the current chatbot persona.',
          });
        }
        
        if (modelResult.model) {
            setModel(modelResult.model);
        } else {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Could not fetch the current chatbot model.',
            });
        }

      } catch (error) {
        console.error('Failed to fetch settings', error);
        toast({
            variant: 'destructive',
            title: 'Error',
            description: (error as Error).message,
        });
      } finally {
        setIsLoading(false);
      }
    }
    fetchSettings();
  }, [toast]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const [personaResult, modelResult] = await Promise.all([
        updateChatbotPersona(persona),
        updateChatbotModel(model),
      ]);

      if (personaResult.success && modelResult.success) {
        toast({
          title: 'Success!',
          description: 'Chatbot settings have been updated.',
        });
      } else {
        throw new Error(personaResult.message || modelResult.message);
      }
    } catch (error) {
       toast({
            variant: 'destructive',
            title: 'Save Failed',
            description: (error as Error).message,
        });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Chatbot Settings</CardTitle>
          <CardDescription>
            Define the persona, behavior, and underlying model of your AI assistant.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
                <div className="grid w-full gap-1.5">
                    <Label htmlFor="persona">Chatbot Persona</Label>
                    <Textarea
                        id="persona"
                        placeholder="e.g., You are a friendly and empathetic assistant. You should use simple language and avoid technical jargon."
                        value={persona}
                        onChange={(e) => setPersona(e.target.value)}
                        className="min-h-[150px]"
                        disabled={isSaving}
                    />
                    <p className="text-sm text-muted-foreground">
                        Provide detailed instructions on how the chatbot should behave.
                    </p>
                </div>

                <div className="grid w-full gap-1.5">
                    <Label htmlFor="model">Chatbot Model</Label>
                     <Select value={model} onValueChange={setModel} disabled={isSaving}>
                        <SelectTrigger id="model">
                            <SelectValue placeholder="Select a model" />
                        </SelectTrigger>
                        <SelectContent>
                            {models.map((m) => (
                                <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <p className="text-sm text-muted-foreground">
                        Choose the AI model that will power your chatbot&apos;s responses.
                    </p>
                </div>
            </>
          )}
        </CardContent>
        <CardFooter className="border-t px-6 py-4">
            <Button onClick={handleSave} disabled={isLoading || isSaving} className="ml-auto">
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Settings
            </Button>
        </CardFooter>
      </Card>
  );
}
