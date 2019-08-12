import { VolumeNode } from '../bookFormat';
import { optimizeVolume } from './optimizeBook';
import { simplifyVolume } from './simplifyBook';

export function preprocessVolume(volume: VolumeNode): VolumeNode {
    const simplified = simplifyVolume(volume);
    const optimized = optimizeVolume(simplified);
    return optimized;
}
