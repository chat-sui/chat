"use client";

import { useState } from "react";
import { Input } from "@workspace/ui/components/input";
import { Button } from "@workspace/ui/components/button";

interface TripleInputActionProps {
  onClick: (v1: string, v2: string, v3: string) => void;
  buttonText?: string;
  placeholders?: [string, string, string];
}

export default function TripleInputAction({
  onClick,
  buttonText = "Submit",
  placeholders = ["Input 1", "Input 2", "Input 3"],
}: TripleInputActionProps) {
  const [v1, setV1] = useState("");
  const [v2, setV2] = useState("");
  const [v3, setV3] = useState("");

  return (
    <div className="flex flex-col gap-3 p-4 border rounded-lg bg-slate-900 border-slate-800 w-full max-w-sm">
      <Input
        value={v1}
        onChange={(e) => setV1(e.target.value)}
        placeholder={placeholders[0]}
        className="bg-slate-800 border-slate-700 text-white"
      />
      <Input
        value={v2}
        onChange={(e) => setV2(e.target.value)}
        placeholder={placeholders[1]}
        className="bg-slate-800 border-slate-700 text-white"
      />
      <Input
        value={v3}
        onChange={(e) => setV3(e.target.value)}
        placeholder={placeholders[2]}
        className="bg-slate-800 border-slate-700 text-white"
      />
      <Button
        className="bg-slate-50 text-slate-900 hover:bg-slate-200"
        onClick={() => onClick(v1, v2, v3)}
      >
        {buttonText}
      </Button>
    </div>
  );
}
