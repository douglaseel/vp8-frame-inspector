import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from "react-router-dom";

import { MediaServerClient } from '../../lib/mediaserver-client';
import { UserData } from '../../lib/types';

import UserView from './UserView';

function Meet({ roomId, roomName, username } : { roomId: string, roomName: string, username: string }) {

  const navigate = useNavigate();

  const meetClientRef = useRef<MediaServerClient | null>(null);
  const [ audioTracks, updateAudioTracks ] = useState(new Map<string, MediaStreamTrack>());
  const [ videoTracks, updateVideoTracks ] = useState(new Map<string, MediaStreamTrack>());
  const [ availableUsers, updateAvailableUsers ] = useState(new Map<string, any>());

  const [ micTrackId, setMicTrackId ] = useState<string | null>(null);
  const [ webcamTrackId, setWebcamTrackId ] = useState<string | null>(null);

  useEffect(() => {
    const meetClient = new MediaServerClient(window.location.origin, roomId, { username });

    meetClient.on('connect', () => {
      console.log('Conectou!');
    });

    meetClient.on('disconnect', () => {
      console.log('Disconnected!');
      navigate('/');
    })
  
    meetClient.on('ready', async (id: string, appData: any, usersData: UserData[]) => {
      console.log('Ready', appData);

      await Promise.all(
        usersData.map(async ({ id, userData, availableTracks }) => {
          availableUsers.set(id, { id, userData });
          await Promise.all(
            availableTracks.map(async ({ trackId, kind, paused }) => {
              if (paused) return;
              const track = await meetClient.startConsumingTrack(id, trackId);
              (kind === 'audio') ? audioTracks.set(id, track) : videoTracks.set(id, track);
            })
          )
        })
      );

      meetClientRef.current = meetClient;

      updateAvailableUsers(new Map(availableUsers));
      updateAudioTracks(new Map(audioTracks));
      updateVideoTracks(new Map(videoTracks));
    });

    meetClient.on('userJoined', (id: string, userData: any) => {
      console.log('UserJoined', id)
      updateAvailableUsers(current => {
        current.set(id, { id, userData });
        return new Map(current);
      });
    });

    meetClient.on('userLeft', (id: string) => {
      console.log('UserLeft', id);
      updateAvailableUsers(current => {
        current.delete(id);
        return new Map(current);
      });

      if (audioTracks.has(id)) {
        updateAudioTracks(current => {
          current.delete(id);
          return new Map(current);
        });
      }

      if (videoTracks.has(id)) {
        updateVideoTracks(current => {
          current.delete(id);
          return new Map(current);
        });
      }
    });

    meetClient.on('newAudioTrackAvailable', async (id: string, trackId: string) : Promise<void> => {
      const track = await meetClient.startConsumingTrack(id, trackId);
      updateAudioTracks(current => {
        current.set(id, track);
        return new Map(current);
      });
    });

    meetClient.on('newVideoTrackAvailable', async (id: string, trackId: string) : Promise<void> => {
      const track = await meetClient.startConsumingTrack(id, trackId);
      updateVideoTracks(current => {
        current.set(id, track);
        return new Map(current);
      });
    });

    meetClient.on('trackEnded',  (id: string, trackId: string) => {
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
      meetClient.disconnect();
    }
  }, [ roomId, username ]);

  const startWebcamStreaming = async () => {
    if (meetClientRef.current && !webcamTrackId) {
      const trackId = await meetClientRef.current.addCameraTrack();
      setWebcamTrackId(trackId);
    }
  }

  const stopWebcamStreaming = async () => {
    if (meetClientRef.current && webcamTrackId) {
      await meetClientRef.current.stopTrack(webcamTrackId);
      setWebcamTrackId(null);
    }
  }

  const startMicStreaming = async () => {
    if (meetClientRef.current && !micTrackId) {
      const trackId = await meetClientRef.current.addMicrophoneTrack();
      setMicTrackId(trackId);
    }
  }

  const stopMicStreaming = async () => {
    if (meetClientRef.current && micTrackId) {
      await meetClientRef.current.stopTrack(micTrackId);
      setMicTrackId(null);
    }
  }

  return (
    <div>
      <h1>Room <span className="roomName">{roomName}</span></h1>

      <label>Microphone:
        <input type="button" onClick={startMicStreaming} value="Start" disabled={!meetClientRef.current || !!micTrackId}/>
        <input type="button" onClick={stopMicStreaming} value="Stop" disabled={!meetClientRef.current || !micTrackId}/>
      </label>

      <label>Webcam:
        <input type="button" onClick={startWebcamStreaming} value="Start" disabled={!meetClientRef.current || !!webcamTrackId}/>
        <input type="button" onClick={stopWebcamStreaming} value="Stop" disabled={!meetClientRef.current || !webcamTrackId}/>
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