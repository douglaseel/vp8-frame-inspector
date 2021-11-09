import { stringify } from 'querystring';
import React, { useEffect, useState, useRef } from 'react';
import { MediaServerClient } from '../../lib/mediaserver-client';
import { UserData } from '../../lib/types';

import UserView from './UserView';

function Meet({ roomId, username } : { roomId: string, username: string }) {

  const mediaClientRef = useRef<MediaServerClient | null>(null);
  const [ audioTracks, updateAudioTracks ] = useState(new Map<string, MediaStreamTrack>());
  const [ videoTracks, updateVideoTracks ] = useState(new Map<string, MediaStreamTrack>());
  const [ availableUsers, updateAvailableUsers ] = useState(new Map<string, any>());

  const [ micTrackId, setMicTrackId ] = useState<string | null>(null);
  const [ webcamTrackId, setWebcamTrackId ] = useState<string | null>(null);

  useEffect(() => {
    
    const mediaClient = new MediaServerClient(window.location.origin, roomId, { username });

    mediaClient.on('connect', () => {
      console.log('Conectou!');
    });
  
    mediaClient.on('ready', async (id: string, appData: any, usersData: UserData[]) => {
      console.log('Ready', appData);
      await Promise.all(
        usersData.map(async ({ id, userData, availableTracks }) => {
          availableUsers.set(id, { id, userData });
          await Promise.all(
            availableTracks.map(async ({ trackId, kind, paused }) => {
              if (paused) return;
              const track = await mediaClient.startConsumingTrack(id, trackId);
              (kind === 'audio') ? audioTracks.set(id, track) : videoTracks.set(id, track);
            })
          )
        })
      );

      mediaClientRef.current = mediaClient;

      updateAvailableUsers(new Map(availableUsers));
      updateAudioTracks(new Map(audioTracks));
      updateVideoTracks(new Map(videoTracks));
    });

    mediaClient.on('userJoined', (id: string, userData: any) => {
      console.log('UserJoined', id)
      updateAvailableUsers(current => {
        current.set(id, { id, userData });
        return new Map(current);
      });
    });

    mediaClient.on('userLeft', (id: string, userData: any) => {
      console.log('UserLeft', id);
      updateAvailableUsers(current => {
        current.delete(id);
        return new Map(current);
      });
    });

    mediaClient.on('newAudioTrackAvailable', async (id: string, trackId: string) : Promise<void> => {
      const track = await mediaClient.startConsumingTrack(id, trackId);
      updateAudioTracks(current => {
        current.set(id, track);
        return new Map(current);
      });
    });

    mediaClient.on('newVideoTrackAvailable', async (id: string, trackId: string) : Promise<void> => {
      const track = await mediaClient.startConsumingTrack(id, trackId);
      updateVideoTracks(current => {
        current.set(id, track);
        return new Map(current);
      });
    });

    mediaClient.on('consumerClosed',  (id: string, trackId: string) => {
      if (audioTracks.has(trackId)) {
        updateAudioTracks(current => {
          current.delete(trackId);
          return new Map(current);
        });
      } else if (videoTracks.has(trackId)) {
        updateVideoTracks(current => {
          current.delete(trackId);
          return new Map(current);
        });
      }
    });

    return () => {
      mediaClient.disconnect();
    }
  }, [ roomId ]);

  const startWebcamStreaming = async () => {
    if (mediaClientRef.current && !webcamTrackId) {
      const trackId = await mediaClientRef.current.addCameraTrack();
      setWebcamTrackId(trackId);
    }
  }

  const stopWebcamStreaming = async () => {
    if (mediaClientRef.current && webcamTrackId) {
      await mediaClientRef.current.stopTrack(webcamTrackId);
      setWebcamTrackId(null);
    }
  }

  const startMicStreaming = async () => {
    if (mediaClientRef.current && !micTrackId) {
      const trackId = await mediaClientRef.current.addMicrophoneTrack();
      setMicTrackId(trackId);
    }
  }

  const stopMicStreaming = async () => {
    if (mediaClientRef.current && micTrackId) {
      await mediaClientRef.current.stopTrack(micTrackId);
      setMicTrackId(null);
    }
  }

  return (
    <div>
      <h1>Room </h1>

      <label>Microphone:
        <input type="button" onClick={startMicStreaming} value="Start" disabled={!mediaClientRef.current || !!micTrackId}/>
        <input type="button" onClick={stopMicStreaming} value="Stop" disabled={!mediaClientRef.current || !micTrackId}/>
      </label>

      <label>Webcam:
        <input type="button" onClick={startWebcamStreaming} value="Start" disabled={!mediaClientRef.current || !!webcamTrackId}/>
        <input type="button" onClick={stopWebcamStreaming} value="Stop" disabled={!mediaClientRef.current || !webcamTrackId}/>
      </label>

      { Array.from(availableUsers.values()).map(({ id, userData }) => (
        <UserView
          key={id}
          id={id}
          userData={userData}
          audioTrack={audioTracks.get(id)}
          videoTrack={videoTracks.get(id)}
        />
      ))}
    </div>
  );
}

export default Meet;