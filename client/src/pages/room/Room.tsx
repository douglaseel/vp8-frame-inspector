import React, { useEffect, useState } from 'react';
import { MediaServerClient } from '../../lib/mediaserver-client';
import { UserData } from '../../lib/types';

import UserView from './UserView';

type RoomProps = {
  id: string,
};

function Room({ id } : RoomProps) {
  const [ audioTracks, updateAudioTracks ] = useState(new Map<string, MediaStreamTrack>());
  const [ videoTracks, updateVideoTracks ] = useState(new Map<string, MediaStreamTrack>());
  const [ availableUsers, updateAvailableUsers ] = useState(new Map<string, any>());

  useEffect(() => {
    if (!id || id === '') {
      return;
    }

    const mediaClient = new MediaServerClient(window.location.origin, id, {});

    mediaClient.on('connect', () => {
      console.log('Conectou!');
    });
  
    mediaClient.on('ready', async (id: string, appData: any, usersData: UserData[]) => {
      console.log('Ready');
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

    // @ts-ignore
    global.mediaClient = mediaClient;

    return () => {
      mediaClient.disconnect();
    }
  }, [ id ]);

  return (
    <div>
      <h1>SALA</h1>
      { Array.from(availableUsers.values()).map(({ id }) => (
        <UserView 
          id={id}
          audioTrack={audioTracks.get(id)}
          videoTrack={videoTracks.get(id)}
        />
      ))}
    </div>
  );
}

export default Room;