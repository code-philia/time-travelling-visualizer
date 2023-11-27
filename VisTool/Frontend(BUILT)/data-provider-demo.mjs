/* Copyright 2016 The TensorFlow Authors. All Rights Reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
==============================================================================*/
import { DataSet } from './data';
import { parseTensors, retrieveSpriteAndMetadataInfo, retrieveTensorAsBytes, TENSORS_MSG_ID, } from './data-provider';
import * as logging from './logging';
const BYTES_EXTENSION = '.bytes';
/** Data provider that loads data from a demo folder. */
export class DemoDataProvider {
    constructor(projectorConfigPath) {
        this.projectorConfigPath = projectorConfigPath;
    }
    getEmbeddingInfo(tensorName) {
        let embeddings = this.projectorConfig.embeddings;
        for (let i = 0; i < embeddings.length; i++) {
            let embedding = embeddings[i];
            if (embedding.tensorName === tensorName) {
                return embedding;
            }
        }
        return null;
    }
    retrieveRuns(callback) {
        callback(['Demo']);
    }
    retrieveProjectorConfig(run, callback) {
        // console.log('ssssss',this.projectorConfigPath)
        // const msgId = logging.setModalMessage('Fetching projector config...');
        // const xhr = new XMLHttpRequest();
        // xhr.open('GET', this.projectorConfigPath);
        // xhr.onerror = (err: any) => {
        //   let errorMessage = err.message;
        //   // If the error is a valid XMLHttpResponse, it's possible this is a
        //   // cross-origin error.
        //   if (xhr.responseText != null) {
        //     errorMessage =
        //       'Cannot fetch projector config, possibly a ' +
        //       'Cross-Origin request error.';
        //   }
        //   logging.setErrorMessage(errorMessage, 'fetching projector config');
        // };
        // xhr.onload = () => {
        //   const projectorConfig = JSON.parse(xhr.responseText) as ProjectorConfig;
        //   logging.setModalMessage(null, msgId);
        //   this.projectorConfig = projectorConfig;
        //   callback(projectorConfig);
        // };
        // xhr.send();
        this.projectorConfig = {
            "embeddings": [
                {
                    "tensorName": "CIFAR10 with images",
                    "tensorShape": [
                        10000,
                        784
                    ],
                    "tensorPath": "https://storage.googleapis.com/embedding-projector/data/mnist_10k_784d_tensors.bytes",
                    "metadataPath": "https://gist.githubusercontent.com/hzf1174/3a7e85af7d09ebdfafac3d4d3ba5e71f/raw/502ad8aedc40fab7e56db917c57b48eaf0bd28fa/metadata.csv",
                    "sprite": {
                        "imagePath": "cifar10.png",
                        "singleImageDim": [
                            32,
                            32
                        ]
                    }
                }
            ],
            "modelCheckpointPath": "Demo datasets",
            "DVIServerIP": "localhost",
            "DVIServerPort": "5001"
        };
        callback(this.projectorConfig);
    }
    retrieveTensor(run, tensorName, callback) {
        let embedding = this.getEmbeddingInfo(tensorName);
        let url = `${embedding.tensorPath}`;
        if (embedding.tensorPath.substr(-1 * BYTES_EXTENSION.length) ===
            BYTES_EXTENSION) {
            retrieveTensorAsBytes(this, this.getEmbeddingInfo(tensorName), run, tensorName, url, callback);
        }
        else {
            logging.setModalMessage('Fetching tensors...', TENSORS_MSG_ID);
            const request = new XMLHttpRequest();
            request.open('GET', url);
            request.responseType = 'arraybuffer';
            request.onerror = () => {
                logging.setErrorMessage(request.responseText, 'fetching tensors');
            };
            request.onload = () => {
                parseTensors(request.response).then((points) => {
                    callback(new DataSet(points));
                });
            };
            request.send();
        }
    }
    retrieveSpriteAndMetadata(run, tensorName, callback) {
        let embedding = {
            "tensorName": "CIFAR10 with images",
            "tensorShape": [
                10000,
                784
            ],
            "tensorPath": "https://storage.googleapis.com/embedding-projector/data/mnist_10k_784d_tensors.bytes",
            "metadataPath": "https://gist.githubusercontent.com/hzf1174/3a7e85af7d09ebdfafac3d4d3ba5e71f/raw/502ad8aedc40fab7e56db917c57b48eaf0bd28fa/metadata.csv",
        };
        let spriteImagePath = null;
        // if (embedding.sprite && embedding.sprite.imagePath) {
        //   spriteImagePath = embedding.sprite.imagePath;
        //   spriteImagePath = `${spriteImagePath}`
        // }
        //@ts-ignore
        retrieveSpriteAndMetadataInfo(embedding.metadataPath, spriteImagePath, {
            "imagePath": "cifar10.png",
            "singleImageDim": [
                32,
                32
            ]
        }, callback);
    }
    getBookmarks(run, tensorName, callback) {
        let embedding = this.getEmbeddingInfo(tensorName);
        let msgId = logging.setModalMessage('Fetching bookmarks...');
        const xhr = new XMLHttpRequest();
        xhr.open('GET', embedding.bookmarksPath);
        xhr.onerror = (err) => {
            logging.setErrorMessage(xhr.responseText);
        };
        xhr.onload = () => {
            const bookmarks = JSON.parse(xhr.responseText);
            logging.setModalMessage(null, msgId);
            callback(bookmarks);
        };
        xhr.send();
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGF0YS1wcm92aWRlci1kZW1vLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vdGVuc29yYm9hcmQvcHJvamVjdG9yL2RhdGEtcHJvdmlkZXItZGVtby50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7Ozs7Ozs7OztnRkFhZ0Y7QUFDaEYsT0FBTyxFQUErQixPQUFPLEVBQUMsTUFBTSxRQUFRLENBQUM7QUFDN0QsT0FBTyxFQUdMLFlBQVksRUFFWiw2QkFBNkIsRUFDN0IscUJBQXFCLEVBQ3JCLGNBQWMsR0FDZixNQUFNLGlCQUFpQixDQUFDO0FBQ3pCLE9BQU8sS0FBSyxPQUFPLE1BQU0sV0FBVyxDQUFDO0FBRXJDLE1BQU0sZUFBZSxHQUFHLFFBQVEsQ0FBQztBQUVqQyx3REFBd0Q7QUFDeEQsTUFBTSxPQUFPLGdCQUFnQjtJQUczQixZQUFZLG1CQUEyQjtRQUNyQyxJQUFJLENBQUMsbUJBQW1CLEdBQUcsbUJBQW1CLENBQUM7SUFDakQsQ0FBQztJQUNPLGdCQUFnQixDQUFDLFVBQWtCO1FBQ3pDLElBQUksVUFBVSxHQUFHLElBQUksQ0FBQyxlQUFlLENBQUMsVUFBVSxDQUFDO1FBQ2pELEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxVQUFVLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO1lBQzFDLElBQUksU0FBUyxHQUFHLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUM5QixJQUFJLFNBQVMsQ0FBQyxVQUFVLEtBQUssVUFBVSxFQUFFO2dCQUN2QyxPQUFPLFNBQVMsQ0FBQzthQUNsQjtTQUNGO1FBQ0QsT0FBTyxJQUFJLENBQUM7SUFDZCxDQUFDO0lBQ0QsWUFBWSxDQUFDLFFBQWtDO1FBQzdDLFFBQVEsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7SUFDckIsQ0FBQztJQUNELHVCQUF1QixDQUNyQixHQUFXLEVBQ1gsUUFBc0M7UUFFdEMsaURBQWlEO1FB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Q2xELDJDQUEyQztRQUMzQyxJQUFJO1FBQ0osWUFBWTtRQUNaLDZCQUE2QixDQUMzQixTQUFTLENBQUMsWUFBWSxFQUN0QixlQUFlLEVBQ2Y7WUFDRSxXQUFXLEVBQUUsYUFBYTtZQUMxQixnQkFBZ0IsRUFBRTtnQkFDaEIsRUFBRTtnQkFDRixFQUFFO2FBQ0g7U0FDRixFQUNELFFBQVEsQ0FDVCxDQUFDO0lBQ0osQ0FBQztJQUNELFlBQVksQ0FDVixHQUFXLEVBQ1gsVUFBa0IsRUFDbEIsUUFBOEI7UUFFOUIsSUFBSSxTQUFTLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQ2xELElBQUksS0FBSyxHQUFHLE9BQU8sQ0FBQyxlQUFlLENBQUMsdUJBQXVCLENBQUMsQ0FBQztRQUM3RCxNQUFNLEdBQUcsR0FBRyxJQUFJLGNBQWMsRUFBRSxDQUFDO1FBQ2pDLEdBQUcsQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFLFNBQVMsQ0FBQyxhQUFhLENBQUMsQ0FBQztRQUN6QyxHQUFHLENBQUMsT0FBTyxHQUFHLENBQUMsR0FBRyxFQUFFLEVBQUU7WUFDcEIsT0FBTyxDQUFDLGVBQWUsQ0FBQyxHQUFHLENBQUMsWUFBWSxDQUFDLENBQUM7UUFDNUMsQ0FBQyxDQUFDO1FBQ0YsR0FBRyxDQUFDLE1BQU0sR0FBRyxHQUFHLEVBQUU7WUFDaEIsTUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsWUFBWSxDQUFZLENBQUM7WUFDMUQsT0FBTyxDQUFDLGVBQWUsQ0FBQyxJQUFJLEVBQUUsS0FBSyxDQUFDLENBQUM7WUFDckMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBQ3RCLENBQUMsQ0FBQztRQUNGLEdBQUcsQ0FBQyxJQUFJLEVBQUUsQ0FBQztJQUNiLENBQUM7Q0FDRiIsInNvdXJjZXNDb250ZW50IjpbIi8qIENvcHlyaWdodCAyMDE2IFRoZSBUZW5zb3JGbG93IEF1dGhvcnMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG5cbkxpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAgKHRoZSBcIkxpY2Vuc2VcIik7XG55b3UgbWF5IG5vdCB1c2UgdGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuXG5Zb3UgbWF5IG9idGFpbiBhIGNvcHkgb2YgdGhlIExpY2Vuc2UgYXRcblxuICAgIGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMFxuXG5Vbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXG5kaXN0cmlidXRlZCB1bmRlciB0aGUgTGljZW5zZSBpcyBkaXN0cmlidXRlZCBvbiBhbiBcIkFTIElTXCIgQkFTSVMsXG5XSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cblNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcbmxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLlxuPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09Ki9cbmltcG9ydCB7U3ByaXRlQW5kTWV0YWRhdGFJbmZvLCBTdGF0ZSwgRGF0YVNldH0gZnJvbSAnLi9kYXRhJztcbmltcG9ydCB7XG4gIERhdGFQcm92aWRlcixcbiAgRW1iZWRkaW5nSW5mbyxcbiAgcGFyc2VUZW5zb3JzLFxuICBQcm9qZWN0b3JDb25maWcsXG4gIHJldHJpZXZlU3ByaXRlQW5kTWV0YWRhdGFJbmZvLFxuICByZXRyaWV2ZVRlbnNvckFzQnl0ZXMsXG4gIFRFTlNPUlNfTVNHX0lELFxufSBmcm9tICcuL2RhdGEtcHJvdmlkZXInO1xuaW1wb3J0ICogYXMgbG9nZ2luZyBmcm9tICcuL2xvZ2dpbmcnO1xuXG5jb25zdCBCWVRFU19FWFRFTlNJT04gPSAnLmJ5dGVzJztcblxuLyoqIERhdGEgcHJvdmlkZXIgdGhhdCBsb2FkcyBkYXRhIGZyb20gYSBkZW1vIGZvbGRlci4gKi9cbmV4cG9ydCBjbGFzcyBEZW1vRGF0YVByb3ZpZGVyIGltcGxlbWVudHMgRGF0YVByb3ZpZGVyIHtcbiAgcHJpdmF0ZSBwcm9qZWN0b3JDb25maWdQYXRoOiBzdHJpbmc7XG4gIHByaXZhdGUgcHJvamVjdG9yQ29uZmlnOiBQcm9qZWN0b3JDb25maWc7XG4gIGNvbnN0cnVjdG9yKHByb2plY3RvckNvbmZpZ1BhdGg6IHN0cmluZykge1xuICAgIHRoaXMucHJvamVjdG9yQ29uZmlnUGF0aCA9IHByb2plY3RvckNvbmZpZ1BhdGg7XG4gIH1cbiAgcHJpdmF0ZSBnZXRFbWJlZGRpbmdJbmZvKHRlbnNvck5hbWU6IHN0cmluZyk6IEVtYmVkZGluZ0luZm8ge1xuICAgIGxldCBlbWJlZGRpbmdzID0gdGhpcy5wcm9qZWN0b3JDb25maWcuZW1iZWRkaW5ncztcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGVtYmVkZGluZ3MubGVuZ3RoOyBpKyspIHtcbiAgICAgIGxldCBlbWJlZGRpbmcgPSBlbWJlZGRpbmdzW2ldO1xuICAgICAgaWYgKGVtYmVkZGluZy50ZW5zb3JOYW1lID09PSB0ZW5zb3JOYW1lKSB7XG4gICAgICAgIHJldHVybiBlbWJlZGRpbmc7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG4gIHJldHJpZXZlUnVucyhjYWxsYmFjazogKHJ1bnM6IHN0cmluZ1tdKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgY2FsbGJhY2soWydEZW1vJ10pO1xuICB9XG4gIHJldHJpZXZlUHJvamVjdG9yQ29uZmlnKFxuICAgIHJ1bjogc3RyaW5nLFxuICAgIGNhbGxiYWNrOiAoZDogUHJvamVjdG9yQ29uZmlnKSA9PiB2b2lkXG4gICk6IHZvaWQge1xuICAgIC8vIGNvbnNvbGUubG9nKCdzc3Nzc3MnLHRoaXMucHJvamVjdG9yQ29uZmlnUGF0aClcbiAgICAvLyBjb25zdCBtc2dJZCA9IGxvZ2dpbmcuc2V0TW9kYWxNZXNzYWdlKCdGZXRjaGluZyBwcm9qZWN0b3IgY29uZmlnLi4uJyk7XG4gICAgLy8gY29uc3QgeGhyID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG4gICAgLy8geGhyLm9wZW4oJ0dFVCcsIHRoaXMucHJvamVjdG9yQ29uZmlnUGF0aCk7XG4gICAgLy8geGhyLm9uZXJyb3IgPSAoZXJyOiBhbnkpID0+IHtcbiAgICAvLyAgIGxldCBlcnJvck1lc3NhZ2UgPSBlcnIubWVzc2FnZTtcbiAgICAvLyAgIC8vIElmIHRoZSBlcnJvciBpcyBhIHZhbGlkIFhNTEh0dHBSZXNwb25zZSwgaXQncyBwb3NzaWJsZSB0aGlzIGlzIGFcbiAgICAvLyAgIC8vIGNyb3NzLW9yaWdpbiBlcnJvci5cbiAgICAvLyAgIGlmICh4aHIucmVzcG9uc2VUZXh0ICE9IG51bGwpIHtcbiAgICAvLyAgICAgZXJyb3JNZXNzYWdlID1cbiAgICAvLyAgICAgICAnQ2Fubm90IGZldGNoIHByb2plY3RvciBjb25maWcsIHBvc3NpYmx5IGEgJyArXG4gICAgLy8gICAgICAgJ0Nyb3NzLU9yaWdpbiByZXF1ZXN0IGVycm9yLic7XG4gICAgLy8gICB9XG4gICAgLy8gICBsb2dnaW5nLnNldEVycm9yTWVzc2FnZShlcnJvck1lc3NhZ2UsICdmZXRjaGluZyBwcm9qZWN0b3IgY29uZmlnJyk7XG4gICAgLy8gfTtcbiAgICAvLyB4aHIub25sb2FkID0gKCkgPT4ge1xuICAgIC8vICAgY29uc3QgcHJvamVjdG9yQ29uZmlnID0gSlNPTi5wYXJzZSh4aHIucmVzcG9uc2VUZXh0KSBhcyBQcm9qZWN0b3JDb25maWc7XG4gICAgLy8gICBsb2dnaW5nLnNldE1vZGFsTWVzc2FnZShudWxsLCBtc2dJZCk7XG4gICAgLy8gICB0aGlzLnByb2plY3RvckNvbmZpZyA9IHByb2plY3RvckNvbmZpZztcbiAgICAvLyAgIGNhbGxiYWNrKHByb2plY3RvckNvbmZpZyk7XG4gICAgLy8gfTtcbiAgICAvLyB4aHIuc2VuZCgpO1xuICAgIHRoaXMucHJvamVjdG9yQ29uZmlnID0ge1xuICAgICAgXCJlbWJlZGRpbmdzXCI6IFtcbiAgICAgICAge1xuICAgICAgICAgIFwidGVuc29yTmFtZVwiOiBcIkNJRkFSMTAgd2l0aCBpbWFnZXNcIixcbiAgICAgICAgICBcInRlbnNvclNoYXBlXCI6IFtcbiAgICAgICAgICAgIDEwMDAwLFxuICAgICAgICAgICAgNzg0XG4gICAgICAgICAgXSxcbiAgICAgICAgICBcInRlbnNvclBhdGhcIjogXCJodHRwczovL3N0b3JhZ2UuZ29vZ2xlYXBpcy5jb20vZW1iZWRkaW5nLXByb2plY3Rvci9kYXRhL21uaXN0XzEwa183ODRkX3RlbnNvcnMuYnl0ZXNcIixcbiAgICAgICAgICBcIm1ldGFkYXRhUGF0aFwiOiBcImh0dHBzOi8vZ2lzdC5naXRodWJ1c2VyY29udGVudC5jb20vaHpmMTE3NC8zYTdlODVhZjdkMDllYmRmYWZhYzNkNGQzYmE1ZTcxZi9yYXcvNTAyYWQ4YWVkYzQwZmFiN2U1NmRiOTE3YzU3YjQ4ZWFmMGJkMjhmYS9tZXRhZGF0YS5jc3ZcIixcbiAgICAgICAgICBcInNwcml0ZVwiOiB7XG4gICAgICAgICAgICBcImltYWdlUGF0aFwiOiBcImNpZmFyMTAucG5nXCIsXG4gICAgICAgICAgICBcInNpbmdsZUltYWdlRGltXCI6IFtcbiAgICAgICAgICAgICAgMzIsXG4gICAgICAgICAgICAgIDMyXG4gICAgICAgICAgICBdXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICBdLFxuICAgICAgXCJtb2RlbENoZWNrcG9pbnRQYXRoXCI6IFwiRGVtbyBkYXRhc2V0c1wiLFxuICAgICAgXCJEVklTZXJ2ZXJJUFwiOiBcImxvY2FsaG9zdFwiLFxuICAgICAgXCJEVklTZXJ2ZXJQb3J0XCI6IFwiNTAwMVwiXG4gICAgfSBhcyBQcm9qZWN0b3JDb25maWdcbiAgICBjYWxsYmFjayh0aGlzLnByb2plY3RvckNvbmZpZylcbiAgfVxuICByZXRyaWV2ZVRlbnNvcihcbiAgICBydW46IHN0cmluZyxcbiAgICB0ZW5zb3JOYW1lOiBzdHJpbmcsXG4gICAgY2FsbGJhY2s6IChkczogRGF0YVNldCkgPT4gdm9pZFxuICApIHtcbiAgICBsZXQgZW1iZWRkaW5nID0gdGhpcy5nZXRFbWJlZGRpbmdJbmZvKHRlbnNvck5hbWUpO1xuICAgIGxldCB1cmwgPSBgJHtlbWJlZGRpbmcudGVuc29yUGF0aH1gO1xuICAgIGlmIChcbiAgICAgIGVtYmVkZGluZy50ZW5zb3JQYXRoLnN1YnN0cigtMSAqIEJZVEVTX0VYVEVOU0lPTi5sZW5ndGgpID09PVxuICAgICAgQllURVNfRVhURU5TSU9OXG4gICAgKSB7XG4gICAgICByZXRyaWV2ZVRlbnNvckFzQnl0ZXMoXG4gICAgICAgIHRoaXMsXG4gICAgICAgIHRoaXMuZ2V0RW1iZWRkaW5nSW5mbyh0ZW5zb3JOYW1lKSxcbiAgICAgICAgcnVuLFxuICAgICAgICB0ZW5zb3JOYW1lLFxuICAgICAgICB1cmwsXG4gICAgICAgIGNhbGxiYWNrXG4gICAgICApO1xuICAgIH0gZWxzZSB7XG4gICAgICBsb2dnaW5nLnNldE1vZGFsTWVzc2FnZSgnRmV0Y2hpbmcgdGVuc29ycy4uLicsIFRFTlNPUlNfTVNHX0lEKTtcbiAgICAgIGNvbnN0IHJlcXVlc3QgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcbiAgICAgIHJlcXVlc3Qub3BlbignR0VUJywgdXJsKTtcbiAgICAgIHJlcXVlc3QucmVzcG9uc2VUeXBlID0gJ2FycmF5YnVmZmVyJztcbiAgICAgIHJlcXVlc3Qub25lcnJvciA9ICgpID0+IHtcbiAgICAgICAgbG9nZ2luZy5zZXRFcnJvck1lc3NhZ2UocmVxdWVzdC5yZXNwb25zZVRleHQsICdmZXRjaGluZyB0ZW5zb3JzJyk7XG4gICAgICB9O1xuICAgICAgcmVxdWVzdC5vbmxvYWQgPSAoKSA9PiB7XG4gICAgICAgIHBhcnNlVGVuc29ycyhyZXF1ZXN0LnJlc3BvbnNlKS50aGVuKChwb2ludHMpID0+IHtcbiAgICAgICAgICBjYWxsYmFjayhuZXcgRGF0YVNldChwb2ludHMpKTtcbiAgICAgICAgfSk7XG4gICAgICB9O1xuICAgICAgcmVxdWVzdC5zZW5kKCk7XG4gICAgfVxuICB9XG4gIHJldHJpZXZlU3ByaXRlQW5kTWV0YWRhdGEoXG4gICAgcnVuOiBzdHJpbmcsXG4gICAgdGVuc29yTmFtZTogc3RyaW5nLFxuICAgIGNhbGxiYWNrOiAocjogU3ByaXRlQW5kTWV0YWRhdGFJbmZvKSA9PiB2b2lkXG4gICkge1xuICAgIGxldCBlbWJlZGRpbmcgPSB7XG4gICAgICBcInRlbnNvck5hbWVcIjogXCJDSUZBUjEwIHdpdGggaW1hZ2VzXCIsXG4gICAgICBcInRlbnNvclNoYXBlXCI6IFtcbiAgICAgICAgMTAwMDAsXG4gICAgICAgIDc4NFxuICAgICAgXSxcbiAgICAgIFwidGVuc29yUGF0aFwiOiBcImh0dHBzOi8vc3RvcmFnZS5nb29nbGVhcGlzLmNvbS9lbWJlZGRpbmctcHJvamVjdG9yL2RhdGEvbW5pc3RfMTBrXzc4NGRfdGVuc29ycy5ieXRlc1wiLFxuICAgICAgXCJtZXRhZGF0YVBhdGhcIjogXCJodHRwczovL2dpc3QuZ2l0aHVidXNlcmNvbnRlbnQuY29tL2h6ZjExNzQvM2E3ZTg1YWY3ZDA5ZWJkZmFmYWMzZDRkM2JhNWU3MWYvcmF3LzUwMmFkOGFlZGM0MGZhYjdlNTZkYjkxN2M1N2I0OGVhZjBiZDI4ZmEvbWV0YWRhdGEuY3N2XCIsXG4gICAgfTtcbiAgICBsZXQgc3ByaXRlSW1hZ2VQYXRoID0gbnVsbDtcbiAgICAvLyBpZiAoZW1iZWRkaW5nLnNwcml0ZSAmJiBlbWJlZGRpbmcuc3ByaXRlLmltYWdlUGF0aCkge1xuICAgIC8vICAgc3ByaXRlSW1hZ2VQYXRoID0gZW1iZWRkaW5nLnNwcml0ZS5pbWFnZVBhdGg7XG4gICAgLy8gICBzcHJpdGVJbWFnZVBhdGggPSBgJHtzcHJpdGVJbWFnZVBhdGh9YFxuICAgIC8vIH1cbiAgICAvL0B0cy1pZ25vcmVcbiAgICByZXRyaWV2ZVNwcml0ZUFuZE1ldGFkYXRhSW5mbyhcbiAgICAgIGVtYmVkZGluZy5tZXRhZGF0YVBhdGgsXG4gICAgICBzcHJpdGVJbWFnZVBhdGgsXG4gICAgICB7XG4gICAgICAgIFwiaW1hZ2VQYXRoXCI6IFwiY2lmYXIxMC5wbmdcIixcbiAgICAgICAgXCJzaW5nbGVJbWFnZURpbVwiOiBbXG4gICAgICAgICAgMzIsXG4gICAgICAgICAgMzJcbiAgICAgICAgXVxuICAgICAgfSxcbiAgICAgIGNhbGxiYWNrXG4gICAgKTtcbiAgfVxuICBnZXRCb29rbWFya3MoXG4gICAgcnVuOiBzdHJpbmcsXG4gICAgdGVuc29yTmFtZTogc3RyaW5nLFxuICAgIGNhbGxiYWNrOiAocjogU3RhdGVbXSkgPT4gdm9pZFxuICApIHtcbiAgICBsZXQgZW1iZWRkaW5nID0gdGhpcy5nZXRFbWJlZGRpbmdJbmZvKHRlbnNvck5hbWUpO1xuICAgIGxldCBtc2dJZCA9IGxvZ2dpbmcuc2V0TW9kYWxNZXNzYWdlKCdGZXRjaGluZyBib29rbWFya3MuLi4nKTtcbiAgICBjb25zdCB4aHIgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcbiAgICB4aHIub3BlbignR0VUJywgZW1iZWRkaW5nLmJvb2ttYXJrc1BhdGgpO1xuICAgIHhoci5vbmVycm9yID0gKGVycikgPT4ge1xuICAgICAgbG9nZ2luZy5zZXRFcnJvck1lc3NhZ2UoeGhyLnJlc3BvbnNlVGV4dCk7XG4gICAgfTtcbiAgICB4aHIub25sb2FkID0gKCkgPT4ge1xuICAgICAgY29uc3QgYm9va21hcmtzID0gSlNPTi5wYXJzZSh4aHIucmVzcG9uc2VUZXh0KSBhcyBTdGF0ZVtdO1xuICAgICAgbG9nZ2luZy5zZXRNb2RhbE1lc3NhZ2UobnVsbCwgbXNnSWQpO1xuICAgICAgY2FsbGJhY2soYm9va21hcmtzKTtcbiAgICB9O1xuICAgIHhoci5zZW5kKCk7XG4gIH1cbn1cbiJdfQ==