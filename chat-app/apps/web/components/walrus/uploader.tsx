// components/walrus-message-uploader.tsx
'use client';

import { useState, useRef, ChangeEvent } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@workspace/ui/components/card';
import { Button } from '@workspace/ui/components/button';
import { Input } from '@workspace/ui/components/input';
import { Label } from '@workspace/ui/components/label';
import { Textarea } from '@workspace/ui/components/textarea';
import { Badge } from '@workspace/ui/components/badge';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@workspace/ui/components/tabs';
import { AlertCircle, FileText, ImageIcon, VideoIcon, Mic, Loader2, UploadCloud } from 'lucide-react';

import {
  uploadMessageBlob,
  WalrusUploadResult,
  MessageFileType,
  MessageBlob,
} from '@/utils/upload_relay';

interface WalrusMessageUploaderProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  signer: any;
  onUploaded?: (result: WalrusUploadResult, message: MessageBlob) => void;
}

export function WalrusMessageUploader(props: WalrusMessageUploaderProps) {
  const { signer, onUploaded } = props;

  const [fileType, setFileType] = useState<MessageFileType>('text');
  const [textValue, setTextValue] = useState('');
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<WalrusUploadResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setDataUrl(null);
      setPreviewName(null);
      return;
    }

    setPreviewName(file.name);

    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        setDataUrl(reader.result);
      } else {
        setError('Failed to read file data.');
      }
    };
    reader.readAsDataURL(file);
  };

  async function handleUpload() {
    if (!signer) {
      setError('Signer is not available. Please connect a wallet or provide a Signer instance.');
      return;
    }

    setError(null);
    setResult(null);

    let message: MessageBlob | null = null;

    if (fileType === 'text') {
      if (!textValue.trim()) {
        setError('Text content is empty.');
        return;
      }
      message = {
        file_type: 'text',
        file: textValue,
        timestamp: new Date().toISOString(),
      };
    } else {
      if (!dataUrl) {
        setError('Please select a file to upload.');
        return;
      }
      message = {
        file_type: fileType,
        file: dataUrl,
        timestamp: new Date().toISOString(),
      };
    }

    try {
      setUploading(true);
      const res = await uploadMessageBlob(message);
      setResult(res);
      onUploaded?.(res, message);
      // optional: reset state for next upload
      // setTextValue('');
      // setDataUrl(null);
      // setPreviewName(null);
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to upload message blob.');
    } finally {
      setUploading(false);
    }
  }

  const hasFilePreview = !!dataUrl && fileType !== 'text';

  return (
    <Card className="w-full max-w-3xl mx-auto shadow-lg border border-border/60 bg-gradient-to-b from-background/70 to-background/40 backdrop-blur-md">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <UploadCloud className="h-5 w-5" />
              <span>Walrus Message Uploader</span>
            </CardTitle>
            <CardDescription>
              Upload text, images, videos, or audio as Walrus blobs on Sui testnet.
            </CardDescription>
          </div>
          <Badge variant={signer ? 'default' : 'outline'}>
            {signer ? 'Signer ready' : 'No signer'}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <Tabs
          value={fileType}
          onValueChange={(val) => {
            setFileType(val as MessageFileType);
            setError(null);
          }}
        >
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="text" className="flex items-center gap-1">
              <FileText className="h-3 w-3" />
              <span className="text-xs">Text</span>
            </TabsTrigger>
            <TabsTrigger value="image" className="flex items-center gap-1">
              <ImageIcon className="h-3 w-3" />
              <span className="text-xs">Image</span>
            </TabsTrigger>
            <TabsTrigger value="video" className="flex items-center gap-1">
              <VideoIcon className="h-3 w-3" />
              <span className="text-xs">Video</span>
            </TabsTrigger>
            <TabsTrigger value="audio" className="flex items-center gap-1">
              <Mic className="h-3 w-3" />
              <span className="text-xs">Audio</span>
            </TabsTrigger>
          </TabsList>

          {/* Text tab */}
          <TabsContent value="text" className="mt-4 space-y-2">
            <Label htmlFor="message-text">Text message</Label>
            <Textarea
              id="message-text"
              value={textValue}
              onChange={(e) => setTextValue(e.target.value)}
              placeholder="Type your message..."
              rows={6}
            />
            <p className="text-xs text-muted-foreground text-right">
              {textValue.length} characters
            </p>
          </TabsContent>

          {/* Image / Video / Audio tabs */}
          {(['image', 'video', 'audio'] as MessageFileType[]).map((t) => (
            <TabsContent key={t} value={t} className="mt-4 space-y-3">
              <div className="space-y-2">
                <Label htmlFor={`file-${t}`}>Select {t} file</Label>
                <Input
                  id={`file-${t}`}
                  ref={fileInputRef}
                  type="file"
                  accept={
                    t === 'image'
                      ? 'image/*'
                      : t === 'video'
                      ? 'video/*'
                      : 'audio/*'
                  }
                  onChange={handleFileChange}
                />
                {previewName && (
                  <p className="text-xs text-muted-foreground">
                    Selected: {previewName}
                  </p>
                )}
              </div>

              {hasFilePreview && fileType === 'image' && (
                <div className="rounded-md border border-border/60 bg-muted/40 p-2 flex justify-center">
                  <img
                    src={dataUrl ?? ''}
                    alt={previewName ?? 'Preview'}
                    className="max-h-64 object-contain rounded-md"
                  />
                </div>
              )}

              {hasFilePreview && fileType === 'video' && (
                <div className="rounded-md border border-border/60 bg-muted/40 p-2">
                  <video
                    controls
                    className="w-full rounded-md"
                    src={dataUrl ?? undefined}
                  />
                </div>
              )}

              {hasFilePreview && fileType === 'audio' && (
                <div className="rounded-md border border-border/60 bg-muted/40 p-2">
                  <audio controls className="w-full" src={dataUrl ?? undefined} />
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>

        {error && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        {result && (
          <div className="mt-2 text-xs text-muted-foreground space-y-1">
            <div>
              <span className="font-semibold">Quilt ID: </span>
              <code className="break-all">{result.id}</code>
            </div>
            <div>
              <span className="font-semibold">Blob ID: </span>
              <code className="break-all">{result.blobId}</code>
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex justify-between items-center gap-3">
        <p className="text-xs text-muted-foreground">
          Your signer must have enough SUI and WAL on testnet to pay for storage and gas.
        </p>
        <Button
          onClick={handleUpload}
          disabled={uploading || !signer}
          className="gap-2 transition-transform active:scale-[0.97]"
        >
          {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
          <span>{uploading ? 'Uploading…' : 'Upload Message'}</span>
        </Button>
      </CardFooter>
    </Card>
  );
}
