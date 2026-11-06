// Firebase uygulaması. Ekranlar bu dosyayı değil, services/types arayüzlerini kullanır.
export { createFirebaseAuthService } from './auth';
export { createFirestoreOccupationRepository, createFirestoreProfileRepository } from './profiles';

export interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}
export { createOccupationAdmin, isAdminAccount, occupationIdFromName } from './admin';
export { createEmergencyNumberAdmin, createFirestoreEmergencyNumberRepository } from './emergency';
export {
  createFirestoreServiceCategoryRepository,
  createServiceCategoryAdmin,
  deleteServiceSuggestionsOf,
  submitServiceSuggestion,
} from './service-categories';
export { createBusinessAdmin, createFirestoreBusinessRepository, DuplicateBusinessError } from './businesses';
export { createFirestoreReviewRepository, createReviewModeration, type ReviewReport } from './reviews';
export {
  createFirestoreFamilyRepository,
  createFirestorePushTokenRepository,
  createFirestoreSosRepository,
  createSosSettingsAdmin,
  SosSendTimeoutError,
} from './sos';
export { createGrantAdmin, listAuditLog, loadOwnGrants, type GrantInput } from './grants';
export {
  createAccountWithSetupLink,
  createOrganizationAdmin,
  loadOwnMemberships,
  memberDocId,
  resendSetupLink,
  type OrganizationInput,
} from './organizations';
export { CITY_PACK_SIZE, createCityGuideAdmin, createFirestoreCityGuideRepository } from './city-guide';
export { createFirestoreShowcaseRepository, createShowcaseAdmin } from './showcase';
export { createDealModeration, createFirestoreDealRepository, deleteDealsOf } from './deals';
export {
  createApprovalAdmin,
  createVerificationRequests,
  type ApprovalActor,
  type TrustedApproverInput,
} from './approvals';
export { createAnnouncementPanel, createFirestoreAnnouncementRepository, type SaveMode } from './announcements';
export { createEventPanel, createFirestoreEventRepository, type JoinedItem } from './events';
export { createFirestoreOfficialProfileRepository, createOfficialProfileAdmin } from './official-profiles';
export { createFirestoreOfficialFollowRepository, getOfficialStats, type OfficialFollowRepository } from './official-follows';
export { createContentStatsReader, createContentStatsRecorder, type ContentOwner } from './content-stats';
export { createImportantDaysService, createPressTemplatesService } from './important-days';
export { createAdoptionPanel, createAdoptionRepository } from './adoption';
export { createPharmacyAdmin, createPharmacyRepository, type DataSourceRun, type PharmacySourceStatus } from './pharmacy';
export { adminPushFromDoc, createAdminPushFeed, createAdminPushOpens, createAdminPushPanel, type AdminPushBilling, type AdminPushInput } from './admin-push';
export { createActivityModeration, createFirestoreActivityRepository, type ActivityReport } from './activities';
export { deletePhotos, PhotoTooLargeError, uploadMedia, uploadPostPhotos, uploadPostVideo, VideoTooLargeError, type PreparedPhoto, type PreparedVideo } from './photos';
export { createFirestorePostRepository, createFramesAdmin, createPostModeration, type CommentReport, type FeedFilter, type FeedPage, type PostReport } from './posts';
export { createFirestoreSocialRepository, createProfileModeration, type ProfileReport } from './social';
export { createBannedWords } from './word-filter';
export { createSearchSuggestions } from './search';
export { cleanVideoUrl, createIntroVideo, INTRO_VIDEO_URL_MAX } from './intro';
export { createNeedsConfig } from './needs';
export { createCommunityAdmin, createFirestoreCommunityRepository } from './community';
export { createHolidayAdmin, createHolidayRepository, readOpenCountries } from './holiday';
export { createFirestoreMessageRepository, createMessageModeration, type MessageReport } from './messages';
export { createFirestoreListingRepository, createListingModeration, type ListingFilter, type ListingPage, type ListingReport } from './listings';
export { createNotificationSettings, createNotificationTriggers } from './notifications';
export { countUsage, createLimitsAdmin, deleteUsageOf, vitrinLimit } from './limits';
export { createFirestoreTravelRepository, createMunicipalTravel, createTravelAdmin, type TravelAdminKind } from './travel';
export { createRoadsidePackAdmin, createRoadsidePackRepository, type RoadsidePackSummary } from './roadside';
export { createTravelPrices } from './travel-prices';
export { createFirebaseStats, type FirebaseStats, type StatsRange } from './stats';
