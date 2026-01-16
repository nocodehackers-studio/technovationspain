import { QRCodeSVG } from 'qrcode.react';

interface QRTicketProps {
  code: string;
  size?: number;
  includeMargin?: boolean;
}

export function QRTicket({ code, size = 200, includeMargin = true }: QRTicketProps) {
  // The QR contains a URL that when scanned can validate the ticket
  const qrValue = `${window.location.origin}/validate/${code}`;
  
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="bg-white p-4 rounded-lg shadow-sm">
        <QRCodeSVG 
          value={qrValue} 
          size={size}
          level="H"
          includeMargin={includeMargin}
        />
      </div>
      <span className="font-mono text-sm font-medium text-muted-foreground">
        {code}
      </span>
    </div>
  );
}
