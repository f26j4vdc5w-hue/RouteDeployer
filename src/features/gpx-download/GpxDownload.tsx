import { Download } from 'lucide-react';

interface Props {
  file: string;
}

export function GpxDownload({ file }: Props) {
  const href = `${import.meta.env.BASE_URL}routes/${file}`;
  return (
    <div className="download">
      <a className="download__button" href={href} download={file}>
        <Download size={18} />
        Route als .gpx herunterladen
      </a>
      <p className="download__file">{file}</p>
    </div>
  );
}
