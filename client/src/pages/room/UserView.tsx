import React, { useEffect, useRef } from 'react';

export type UserViewProps = {
  id: string,
  audioTrack?: MediaStreamTrack,
  videoTrack?: MediaStreamTrack
}

function UserView({ id, audioTrack, videoTrack } : UserViewProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (audioRef?.current) {
      audioRef.current.srcObject = audioTrack ? 
        new MediaStream([ audioTrack ]) : null;
    }
  }, [ audioTrack ]);

  useEffect(() => {
    if (videoRef?.current) {
      videoRef.current.srcObject = videoTrack ? 
        new MediaStream([ videoTrack ]) : null;
    }
  }, [ videoTrack ]);
  
  return (
    <div>
      <p>UserId: {id}</p>
      <video ref={videoRef} autoPlay/>
      <audio ref={audioRef} autoPlay/>
    </div>
  );
}

export default UserView;