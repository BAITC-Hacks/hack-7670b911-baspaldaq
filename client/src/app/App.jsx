import { Route, Routes } from "react-router-dom";
import HomePage from "../pages/HomePage.jsx";
import { BusinessProposalsPage, BusinessTasksPage, CatalogPage, ProposalPage, TaskDetailsPage, TaskReviewPage, TeamPage } from "../pages/MarketplacePages.jsx";
import BaspaldaqExperience from "../features/experience/BaspaldaqExperience.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/business/new" element={<BaspaldaqExperience />} />
      <Route path="/business" element={<BusinessTasksPage />} />
      <Route path="/business/tasks/:taskId" element={<BaspaldaqExperience />} />
      <Route path="/business/tasks/:taskId/review" element={<TaskReviewPage />} />
      <Route path="/business/tasks/:taskId/proposals" element={<BusinessProposalsPage />} />
      <Route path="/catalog" element={<CatalogPage />} />
      <Route path="/tasks/:taskId" element={<TaskDetailsPage />} />
      <Route path="/tasks/:taskId/proposal" element={<ProposalPage />} />
      <Route path="/team" element={<TeamPage />} />
    </Routes>
  );
}
