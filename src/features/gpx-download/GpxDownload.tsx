import { Download } from 'lucide-react';

interface Props {
  file: string;
}

export function GpxDownload({ file }: Props) {
  const filename = decodeURIComponent(new URL(file).pathname.split('/').at(-1) ?? 'route.gpx');
  return (
    <div className="download">
      <a className="download__button" href={file} download={filename}>
        <Download size={18} />
        Route als .gpx herunterladen
      </a>
      <p className="download__file">{filename}</p>
    </div>
  );
}
