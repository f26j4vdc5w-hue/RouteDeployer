import { Download } from 'lucide-react';
import type { ReactNode } from 'react';

interface Props {
  file: string;
  action?: ReactNode;
}

export function GpxDownload({ file, action }: Props) {
  const filename = decodeURIComponent(new URL(file).pathname.split('/').at(-1) ?? 'route.gpx');
  return (
    <div className="download">
      <div className="download__actions">
        <a className="download__button" href={file} download={filename}>
          <Download size={18} />
          Route als .gpx herunterladen
        </a>
        {action}
      </div>
      <p className="download__file">{filename}</p>
    </div>
  );
}
