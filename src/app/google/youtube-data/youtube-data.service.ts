import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { google, youtube_v3 } from 'googleapis';
import ytdl from '@distube/ytdl-core';
import ytSearch from 'yt-search';

@Injectable()
export class YoutubeDataService {
  private youtubeClient: youtube_v3.Youtube;
  private logger = new Logger(YoutubeDataService.name);
  private readonly apiKey: string;

  constructor() {
    this.apiKey = process.env.YOUTUBE_API_KEY;
    if (!this.apiKey) {
      throw new Error('YouTube API key is not set in environment variables.');
    }

    this.youtubeClient = google.youtube({ version: 'v3', auth: this.apiKey });
  }

  async getVideoList(query: string): Promise<any> {
    try {
      const results = await ytSearch(query);
      return results.videos.slice(0, 5);
    } catch (error) {
      console.log('Error searching YouTube:', error.message);
    }
  }

  async getVideoDetails(videoId: string): Promise<any> {
    try {
      const response = await this.youtubeClient.videos.list({
        part: ['snippet', 'contentDetails', 'statistics'],
        id: [videoId]
      });

      if (response.data.items.length === 0) {
        throw new HttpException('Video not found', HttpStatus.NOT_FOUND);
      }

      return response.data.items[0];
    } catch (error) {
      this.logger.error(`Failed to get video details: ${error.message}`);
      throw new HttpException(`Failed to get video details: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async streamAudio(videoId: string) {
    const url: string = `https://www.youtube.com/watch?v=${videoId}`;

    if (!ytdl.validateURL(url)) {
      throw new HttpException('Invalid YouTube URL', HttpStatus.BAD_REQUEST);
    }

    try {
      const videoReadableStream = ytdl(url, {
        filter: 'audioonly',
        quality: 'highest',
      });

      return new Promise<Buffer>((resolve, reject) => {
        const chunks: Buffer[] = [];
        videoReadableStream.on('data', (chunk) => chunks.push(chunk));
        videoReadableStream.on('end', () => resolve(Buffer.concat(chunks)));
        videoReadableStream.on('error', (err) => reject(err));
      });
    } catch (error) {
      throw new HttpException(`Failed to stream audio: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}